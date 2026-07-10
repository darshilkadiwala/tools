import { addMonths, endOfMonth, getDate, isAfter, isBefore, setDate, startOfDay, startOfMonth } from 'date-fns';

import { dateToISO, isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry, EMIStatus, Loan, LoanModification } from '@/types';

import { getPartialPeriodRatio, isShortPartialPeriodGap, resolveAdjustmentAmounts } from './adjustments';
import { getLoanComponents, getTotalPrincipal, hasInsuranceComponent } from './emi-formula';
import {
  calculateRepaymentComponents,
  generateMoratoriumSchedule,
  hasMoratoriumPeriod,
  resolveEmiPostingOrder,
  resolveInterestAccrualMethod,
} from './moratorium';

/**
 * Determine EMI status based on due date
 */
export function getEMIStatus(dueDate: string | Date, existingStatus?: EMIStatus): EMIStatus {
  // If already marked as paid or modified, keep that status
  if (existingStatus === 'paid' || existingStatus === 'modified') {
    return existingStatus;
  }

  const today = startOfDay(new Date());
  const due = startOfDay(typeof dueDate === 'string' ? isoToDate(dueDate) : dueDate);

  if (isBefore(due, today)) {
    return 'pending';
  } else if (isAfter(due, today)) {
    // Future due date - mark as upcoming
    return 'upcoming';
  } else {
    // Today - mark as pending
    return 'pending';
  }
}

/**
 * Current outstanding principal: total principal if nothing is paid yet,
 * otherwise the balance remaining after the most recently paid EMI.
 */
export function getCurrentOutstanding(schedule: EMIScheduleEntry[], totalPrincipal: number): number {
  if (schedule.length === 0) {
    return totalPrincipal;
  }

  let lastPaidOutstanding: number | null = null;

  for (const emi of schedule) {
    if (emi.status === 'paid') {
      lastPaidOutstanding = emi.outstandingPrincipal;
    }
  }

  return lastPaidOutstanding ?? totalPrincipal;
}

/**
 * Generate complete EMI schedule for a loan
 */
export function generateEMISchedule(loan: Loan, modifications: LoanModification[] = []): EMIScheduleEntry[] {
  const schedule: EMIScheduleEntry[] = [];
  const monthlyRate = loan.interestRate / 100 / 12;
  const loanComponents = getLoanComponents(loan);
  const isSplitLoan = hasInsuranceComponent(loan);
  const totalPrincipal = getTotalPrincipal(loan);

  const componentBalances = loanComponents.map((component) => ({
    label: component.label,
    outstanding: component.principal,
    emiAmount: component.emiAmount,
  }));

  let outstandingPrincipal = totalPrincipal;

  const sortedModifications = [...modifications].sort(
    (a, b) => isoToDate(a.date).getTime() - isoToDate(b.date).getTime(),
  );

  const emiStart = isoToDate(loan.emiStartDate || loan.startDate);
  const loanStartDate = isoToDate(loan.startDate);
  const emiStartMonth = startOfMonth(emiStart);
  const isMoratoriumLoan = hasMoratoriumPeriod(loanStartDate, emiStart);
  const needsPartialAdjustment = isShortPartialPeriodGap(loanStartDate, emiStart);
  const rounding = loan.interestRounding ?? 'round';
  const accrualMethod = resolveInterestAccrualMethod(loan);
  const postingOrder = resolveEmiPostingOrder(loan);

  let emiCounter = 1;
  const adjustmentType = loan.adjustmentType ?? (isSplitLoan ? 'interest_only' : 'proportional');
  const shouldAddAdjustment = needsPartialAdjustment && loan.emiStartDate && adjustmentType !== 'none';

  if (
    isMoratoriumLoan &&
    (loan.disbursedPrincipal !== undefined ||
      (loan.disbursements?.length ?? 0) > 0 ||
      (loan.moratoriumRateChanges?.length ?? 0) > 0)
  ) {
    const moratorium = generateMoratoriumSchedule(loan);
    schedule.push(...moratorium.entries);
  }

  if (shouldAddAdjustment) {
    const adjustmentDueDate = loanStartDate;
    const { partialDaysRatio, daysFromStart } = getPartialPeriodRatio(loanStartDate);
    const resolved = resolveAdjustmentAmounts(
      adjustmentType,
      outstandingPrincipal,
      monthlyRate,
      loan.emiAmount,
      partialDaysRatio,
      loan.customAdjustmentPrincipal,
      loan.customAdjustmentInterest,
      {
        loanComponents,
        annualInterestRate: loan.interestRate,
        daysFromStart,
        interestRounding: loan.interestRounding ?? 'round',
      },
    );

    const adjustment = resolved.amounts;

    if (isSplitLoan && resolved.components) {
      resolved.components.forEach((component, index) => {
        const balance = componentBalances[index];
        if (balance) {
          balance.outstanding = Math.round((balance.outstanding - component.principal) * 100) / 100;
        }
      });
    } else {
      const homeShare = loan.principal / totalPrincipal;
      componentBalances[0].outstanding =
        Math.round((componentBalances[0].outstanding - adjustment.principal * homeShare) * 100) / 100;
      if (componentBalances[1]) {
        componentBalances[1].outstanding =
          Math.round((componentBalances[1].outstanding - adjustment.principal * (1 - homeShare)) * 100) / 100;
      }
    }

    outstandingPrincipal =
      Math.round(componentBalances.reduce((sum, component) => sum + component.outstanding, 0) * 100) / 100;

    schedule.push({
      id: `${loan.id}-emi-adjustment`,
      loanId: loan.id,
      emiNumber: 0,
      dueDate: dateToISO(adjustmentDueDate),
      principal: adjustment.principal,
      interest: adjustment.interest,
      total: adjustment.total,
      outstandingPrincipal: Math.max(0, outstandingPrincipal),
      status: getEMIStatus(adjustmentDueDate),
      isAdjustment: true,
      adjustmentComponents: resolved.components,
    });

    emiCounter = 1;
  }

  const regularEMIStartMonth = emiStartMonth;

  const emiDay = loan.emiStartDate ? getDate(isoToDate(loan.emiStartDate)) : getDate(emiStart);
  const isFixedEmi = loan.emiCalculationMode === 'fixed';
  const maxIterations = isFixedEmi ? Math.max(loan.tenureMonths, 600) : loan.tenureMonths;

  if (isFixedEmi && isSplitLoan) {
    componentBalances.forEach((component, index) => {
      const share = loanComponents[index].principal / totalPrincipal;
      component.emiAmount = Math.round(loan.emiAmount * share * 100) / 100;
    });
  }

  for (let i = 0; i < maxIterations; i++) {
    if (outstandingPrincipal <= 0.01) {
      break;
    }

    if (isFixedEmi && i >= loan.tenureMonths) {
      if (outstandingPrincipal <= 0.01) {
        break;
      }
      // Fixed EMI below formula amount: continue past contractual tenure until repaid
    } else if (i >= loan.tenureMonths) {
      break;
    }
    const monthForEMI = addMonths(regularEMIStartMonth, i);
    let dueDate = setDate(monthForEMI, emiDay);

    if (getDate(dueDate) !== emiDay) {
      dueDate = endOfMonth(monthForEMI);
    }

    const modification = sortedModifications.find(
      (m) =>
        m.affectedEMIs.includes(emiCounter) ||
        (isoToDate(m.date).getTime() <= dueDate.getTime() && m.type === 'interest_change'),
    );

    const effectiveRate = modification?.newInterestRate ?? loan.interestRate;
    const effectiveMonthlyRate = effectiveRate / 100 / 12;

    let principalComponent = 0;
    let interest = 0;

    if (isSplitLoan) {
      for (const component of componentBalances) {
        const componentInterest = Math.round(component.outstanding * effectiveMonthlyRate * 100) / 100;
        const componentPrincipal = Math.round((component.emiAmount - componentInterest) * 100) / 100;
        const actualPrincipal = Math.min(componentPrincipal, component.outstanding);

        interest += componentInterest;
        principalComponent += actualPrincipal;
        component.outstanding = Math.round((component.outstanding - actualPrincipal) * 100) / 100;
      }
    } else {
      const cycle = calculateRepaymentComponents(
        outstandingPrincipal,
        loan.emiAmount,
        effectiveRate,
        monthForEMI,
        postingOrder,
        accrualMethod,
        rounding,
      );
      interest = cycle.interest;
      principalComponent = cycle.principal;
      outstandingPrincipal = cycle.closingBalance;
    }

    if (isSplitLoan) {
      outstandingPrincipal =
        Math.round(componentBalances.reduce((sum, component) => sum + component.outstanding, 0) * 100) / 100;
    }

    const actualTotal = principalComponent + interest;

    schedule.push({
      id: `${loan.id}-emi-${emiCounter}`,
      loanId: loan.id,
      emiNumber: emiCounter,
      dueDate: dateToISO(dueDate),
      principal: principalComponent,
      interest,
      total: actualTotal,
      outstandingPrincipal: Math.max(0, outstandingPrincipal),
      status: getEMIStatus(dueDate),
      modifiedInterestRate: modification?.newInterestRate,
      isAdjustment: false,
    });

    emiCounter++;
  }

  return schedule;
}
