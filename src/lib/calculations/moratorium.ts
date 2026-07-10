import {
  addMonths,
  differenceInDays,
  endOfMonth,
  getDate,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
} from 'date-fns';

import { dateToISO, isoToDate } from '@/lib/utils';

import type {
  EmiPostingOrder,
  EMIScheduleEntry,
  InterestAccrualMethod,
  InterestRoundingMode,
  Loan,
  MoratoriumRateChange,
} from '@/types';

import { isShortPartialPeriodGap } from './adjustments';
import { applyInterestRounding, calculateActual365Interest } from './emi-formula';
import { getEMIStatus } from './schedule';

/** Days in a calendar month (inclusive). */
function getDaysInMonth(date: Date): number {
  return differenceInDays(endOfMonth(date), startOfMonth(date)) + 1;
}

function calculateMonthlyInterest(
  outstanding: number,
  annualRate: number,
  monthDate: Date,
  method: InterestAccrualMethod,
  rounding: InterestRoundingMode,
): number {
  const days = getDaysInMonth(monthDate);
  if (method === 'actual_365') {
    return calculateActual365Interest(outstanding, annualRate, days, rounding);
  }
  return applyInterestRounding(outstanding * (annualRate / 100 / 12), rounding);
}

export function calculateRepaymentComponents(
  openingBalance: number,
  emiAmount: number,
  annualRate: number,
  monthDate: Date,
  postingOrder: EmiPostingOrder,
  accrualMethod: InterestAccrualMethod,
  rounding: InterestRoundingMode,
): { principal: number; interest: number; total: number; closingBalance: number } {
  if (openingBalance <= 0) {
    return { principal: 0, interest: 0, total: 0, closingBalance: 0 };
  }

  const effectiveEmi = Math.min(emiAmount, openingBalance + emiAmount);

  if (postingOrder === 'emi_first') {
    const balanceAfterEmi = Math.max(0, Math.round((openingBalance - emiAmount) * 100) / 100);
    const interest = calculateMonthlyInterest(balanceAfterEmi, annualRate, monthDate, accrualMethod, rounding);
    const closingBalance = Math.round((balanceAfterEmi + interest) * 100) / 100;
    const netPrincipal = Math.round((openingBalance - closingBalance) * 100) / 100;

    return {
      principal: Math.max(0, Math.min(netPrincipal, openingBalance)),
      interest,
      total: Math.min(emiAmount, openingBalance + interest),
      closingBalance: Math.max(0, closingBalance),
    };
  }

  const monthlyRate = annualRate / 100 / 12;
  const interest =
    accrualMethod === 'actual_365'
      ? calculateMonthlyInterest(openingBalance, annualRate, monthDate, accrualMethod, rounding)
      : Math.round(openingBalance * monthlyRate * 100) / 100;
  const principal = Math.round((effectiveEmi - interest) * 100) / 100;
  const actualPrincipal = Math.min(Math.max(0, principal), openingBalance);
  const closingBalance = Math.round((openingBalance - actualPrincipal) * 100) / 100;

  return {
    principal: actualPrincipal,
    interest,
    total: actualPrincipal + interest,
    closingBalance: Math.max(0, closingBalance),
  };
}

/**
 * True when there is a multi-month study/moratorium gap between disbursement and first EMI.
 */
export function hasMoratoriumPeriod(startDate: string | Date, emiStartDate: string | Date): boolean {
  const loanStartDate = typeof startDate === 'string' ? isoToDate(startDate) : startDate;
  const emiStart = typeof emiStartDate === 'string' ? isoToDate(emiStartDate) : emiStartDate;

  if (isBefore(emiStart, loanStartDate)) {
    return false;
  }

  if (loanStartDate.getTime() === emiStart.getTime()) {
    return false;
  }

  return !isShortPartialPeriodGap(startDate, emiStartDate);
}

/** Count full calendar months in the moratorium (from disbursement month through month before first EMI). */
export function getMoratoriumMonthCount(startDate: string | Date, emiStartDate: string | Date): number {
  if (!hasMoratoriumPeriod(startDate, emiStartDate)) {
    return 0;
  }

  const loanStartDate = typeof startDate === 'string' ? isoToDate(startDate) : startDate;
  const emiStart = typeof emiStartDate === 'string' ? isoToDate(emiStartDate) : emiStartDate;
  const loanStartMonth = startOfMonth(loanStartDate);
  const emiStartMonth = startOfMonth(emiStart);

  let count = 0;
  let cursor = loanStartMonth;
  while (isBefore(cursor, emiStartMonth)) {
    count++;
    cursor = addMonths(cursor, 1);
  }

  return count;
}

export function resolveInterestAccrualMethod(
  loan: Pick<Loan, 'type' | 'interestAccrualMethod' | 'startDate' | 'emiStartDate'>,
): InterestAccrualMethod {
  if (loan.interestAccrualMethod) {
    return loan.interestAccrualMethod;
  }
  if (loan.type === 'education' && loan.emiStartDate && hasMoratoriumPeriod(loan.startDate, loan.emiStartDate)) {
    return 'actual_365';
  }
  return 'monthly_reducing';
}

export function resolveEmiPostingOrder(
  loan: Pick<Loan, 'type' | 'emiPostingOrder' | 'startDate' | 'emiStartDate'>,
): EmiPostingOrder {
  if (loan.emiPostingOrder) {
    return loan.emiPostingOrder;
  }
  if (loan.type === 'education') {
    return 'emi_first';
  }
  return 'standard';
}

/** Effective annual rate at a given date, applying moratorium rate changes chronologically. */
export function getEffectiveMoratoriumRate(date: Date, baseRate: number, rateChanges: MoratoriumRateChange[]): number {
  let rate = baseRate;
  const sorted = [...rateChanges].sort((a, b) => isoToDate(a.date).getTime() - isoToDate(b.date).getTime());

  for (const change of sorted) {
    const changeDate = startOfDay(isoToDate(change.date));
    if (!isAfter(changeDate, startOfDay(date))) {
      rate = change.newInterestRate;
    }
  }

  return rate;
}

/** Monthly moratorium interest, splitting the month when a rate change occurs mid-period. */
export function calculateMoratoriumMonthInterest(
  outstanding: number,
  baseRate: number,
  rateChanges: MoratoriumRateChange[],
  monthDate: Date,
  accrualMethod: InterestAccrualMethod,
  rounding: InterestRoundingMode,
): { interest: number; appliedRate: number } {
  if (outstanding <= 0) {
    return { interest: 0, appliedRate: baseRate };
  }

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const changesInMonth = [...rateChanges]
    .filter((change) => {
      const changeDate = isoToDate(change.date);
      return !isBefore(changeDate, monthStart) && !isAfter(changeDate, monthEnd);
    })
    .sort((a, b) => isoToDate(a.date).getTime() - isoToDate(b.date).getTime());

  if (changesInMonth.length === 0 || accrualMethod !== 'actual_365') {
    const rate = getEffectiveMoratoriumRate(monthEnd, baseRate, rateChanges);
    return {
      interest: calculateMonthlyInterest(outstanding, rate, monthDate, accrualMethod, rounding),
      appliedRate: rate,
    };
  }

  let interest = 0;
  let periodStart = monthStart;
  let currentRate = getEffectiveMoratoriumRate(monthStart, baseRate, rateChanges);

  for (const change of changesInMonth) {
    const changeDate = isoToDate(change.date);
    const daysBeforeChange = differenceInDays(changeDate, periodStart);
    if (daysBeforeChange > 0) {
      interest += calculateActual365Interest(outstanding, currentRate, daysBeforeChange, rounding);
    }
    periodStart = changeDate;
    currentRate = change.newInterestRate;
  }

  const daysRemaining = differenceInDays(monthEnd, periodStart) + 1;
  interest += calculateActual365Interest(outstanding, currentRate, daysRemaining, rounding);

  return { interest, appliedRate: currentRate };
}

/** Part-period interest on a mid-month tranche from disbursement date through month-end. */
function calculateTranchePartPeriodInterest(
  amount: number,
  disbDate: Date,
  baseRate: number,
  rateChanges: MoratoriumRateChange[],
  rounding: InterestRoundingMode,
): number {
  const monthEnd = endOfMonth(disbDate);
  const days = differenceInDays(monthEnd, disbDate) + 1;
  const daysInMonth = getDaysInMonth(disbDate);

  if (days <= 0 || days >= daysInMonth) {
    return 0;
  }

  const rate = getEffectiveMoratoriumRate(disbDate, baseRate, rateChanges);
  return calculateActual365Interest(amount, rate, days, rounding);
}

/**
 * Generate interest-only moratorium entries with monthly capitalization (actual/365).
 * Supports tranche disbursements and mid-moratorium rate changes.
 */
export function generateMoratoriumSchedule(loan: Loan): { entries: EMIScheduleEntry[]; endOutstanding: number } {
  const entries: EMIScheduleEntry[] = [];
  const emiStart = isoToDate(loan.emiStartDate!);
  const loanStartDate = isoToDate(loan.startDate);
  const rounding = loan.interestRounding ?? 'round';
  const accrualMethod = resolveInterestAccrualMethod(loan);
  const rateChanges = loan.moratoriumRateChanges ?? [];

  const sortedDisbursements = [...(loan.disbursements ?? [])].sort(
    (a, b) => isoToDate(a.date).getTime() - isoToDate(b.date).getTime(),
  );

  const hasTranches = sortedDisbursements.length > 0;
  let outstanding = hasTranches ? 0 : (loan.disbursedPrincipal ?? 0);

  let cursor = startOfMonth(loanStartDate);
  const emiStartMonth = startOfMonth(emiStart);
  let moratoriumCounter = 1;
  let appliedDisbursementCount = 0;

  while (isBefore(cursor, emiStartMonth)) {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);

    const disbsThisMonth = sortedDisbursements.filter((disb) => {
      const disbDate = isoToDate(disb.date);
      return !isBefore(disbDate, monthStart) && !isAfter(disbDate, monthEnd);
    });

    const balanceBeforeDisbs = outstanding;

    for (const disb of disbsThisMonth) {
      const disbDate = isoToDate(disb.date);
      outstanding = Math.round((outstanding + disb.amount) * 100) / 100;
      appliedDisbursementCount++;

      entries.push({
        id: `${loan.id}-disb-${appliedDisbursementCount}`,
        loanId: loan.id,
        emiNumber: -(moratoriumCounter + 1000),
        dueDate: dateToISO(disbDate),
        principal: disb.amount,
        interest: 0,
        total: disb.amount,
        outstandingPrincipal: outstanding,
        status: getEMIStatus(disbDate),
        isMoratorium: true,
        isDisbursement: true,
        disbursementLabel: disb.label,
      });

      if (getDate(disbDate) > 1) {
        const partInterest = calculateTranchePartPeriodInterest(
          disb.amount,
          disbDate,
          loan.interestRate,
          rateChanges,
          rounding,
        );

        if (partInterest > 0) {
          outstanding = Math.round((outstanding + partInterest) * 100) / 100;
          entries.push({
            id: `${loan.id}-moratorium-${moratoriumCounter}`,
            loanId: loan.id,
            emiNumber: -moratoriumCounter,
            dueDate: dateToISO(monthEnd),
            principal: 0,
            interest: partInterest,
            total: partInterest,
            outstandingPrincipal: outstanding,
            status: getEMIStatus(monthEnd),
            isMoratorium: true,
            modifiedInterestRate: getEffectiveMoratoriumRate(disbDate, loan.interestRate, rateChanges),
          });
          moratoriumCounter++;
        }
      }
    }

    const hasMidMonthDisb = disbsThisMonth.some((disb) => getDate(isoToDate(disb.date)) > 1);
    const interestBase = hasMidMonthDisb ? balanceBeforeDisbs : outstanding;

    if (interestBase > 0) {
      const { interest, appliedRate } = calculateMoratoriumMonthInterest(
        interestBase,
        loan.interestRate,
        rateChanges,
        cursor,
        accrualMethod,
        rounding,
      );

      if (interest > 0) {
        outstanding = Math.round((outstanding + interest) * 100) / 100;
        entries.push({
          id: `${loan.id}-moratorium-${moratoriumCounter}`,
          loanId: loan.id,
          emiNumber: -moratoriumCounter,
          dueDate: dateToISO(monthEnd),
          principal: 0,
          interest,
          total: interest,
          outstandingPrincipal: outstanding,
          status: getEMIStatus(monthEnd),
          isMoratorium: true,
          modifiedInterestRate: appliedRate !== loan.interestRate ? appliedRate : undefined,
        });
        moratoriumCounter++;
      }
    }

    cursor = addMonths(cursor, 1);
  }

  entries.sort((a, b) => isoToDate(a.dueDate).getTime() - isoToDate(b.dueDate).getTime());

  return { entries, endOutstanding: outstanding };
}
