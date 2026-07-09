import {
  addMonths,
  differenceInDays,
  endOfMonth,
  getDate,
  isAfter,
  isBefore,
  setDate,
  startOfDay,
  startOfMonth,
} from 'date-fns';

import { getNumberLocale } from '@/lib/locale';
import { dateToISO, isoToDate } from '@/lib/utils';

import type {
  AdjustmentType,
  EMIScheduleEntry,
  EMIStatus,
  InterestRoundingMode,
  Loan,
  LoanModification,
} from '@/types';

export interface AdjustmentAmounts {
  principal: number;
  interest: number;
  total: number;
}

export interface LoanComponentBreakdown {
  label: string;
  principal: number;
  emiAmount: number;
}

export interface AdjustmentComponentBreakdown {
  label: string;
  principal: number;
  interest: number;
}

export function getTotalPrincipal(loan: Pick<Loan, 'principal' | 'insuranceAmount'>): number {
  return loan.principal + (loan.insuranceAmount ?? 0);
}

export function hasInsuranceComponent(loan: Pick<Loan, 'insuranceAmount'>): boolean {
  return (loan.insuranceAmount ?? 0) > 0;
}

export function getLoanComponents(
  loan: Pick<Loan, 'principal' | 'insuranceAmount' | 'interestRate' | 'tenureMonths'>,
): LoanComponentBreakdown[] {
  const components: LoanComponentBreakdown[] = [
    {
      label: 'Principal',
      principal: loan.principal,
      emiAmount: calculateEMI(loan.principal, loan.interestRate, loan.tenureMonths),
    },
  ];

  if (hasInsuranceComponent(loan)) {
    components.push({
      label: 'Insurance',
      principal: loan.insuranceAmount!,
      emiAmount: calculateEMI(loan.insuranceAmount!, loan.interestRate, loan.tenureMonths),
    });
  }

  return components;
}

export function calculateTotalLoanEMI(
  principal: number,
  insuranceAmount: number | undefined,
  annualInterestRate: number,
  tenureMonths: number,
): number {
  const homeEmi = calculateEMI(principal, annualInterestRate, tenureMonths);
  const insuranceEmi =
    insuranceAmount && insuranceAmount > 0 ? calculateEMI(insuranceAmount, annualInterestRate, tenureMonths) : 0;

  return Math.round((homeEmi + insuranceEmi) * 100) / 100;
}

export function applyInterestRounding(amount: number, mode: InterestRoundingMode = 'round'): number {
  switch (mode) {
    case 'floor':
      return Math.floor(amount);
    case 'ceil':
      return Math.ceil(amount);
    case 'round':
    default:
      return Math.round(amount);
  }
}

/** Daily interest using actual/365 (how many banks charge broken-period interest per sub-loan). */
export function calculateActual365Interest(
  principal: number,
  annualInterestRate: number,
  days: number,
  rounding: InterestRoundingMode = 'round',
): number {
  const raw = principal * (annualInterestRate / 100) * (days / 365);
  return applyInterestRounding(raw, rounding);
}

function calculateSplitInterestOnlyAdjustment(
  components: LoanComponentBreakdown[],
  annualInterestRate: number,
  days: number,
  rounding: InterestRoundingMode = 'round',
): { components: AdjustmentComponentBreakdown[]; total: AdjustmentAmounts } {
  const breakdown: AdjustmentComponentBreakdown[] = components.map((component) => ({
    label: component.label,
    principal: 0,
    interest: calculateActual365Interest(component.principal, annualInterestRate, days, rounding),
  }));

  const interest = breakdown.reduce((sum, row) => sum + row.interest, 0);

  return {
    components: breakdown,
    total: {
      principal: 0,
      interest,
      total: interest,
    },
  };
}

export interface AdjustmentPreview extends AdjustmentAmounts {
  needsAdjustment: boolean;
  daysFromStart: number;
  daysInMonth: number;
  partialDaysRatio: number;
  proportional: AdjustmentAmounts;
  interestOnly: AdjustmentAmounts;
  /** Per sub-loan interest when home + insurance are financed separately */
  splitInterestOnly?: {
    components: AdjustmentComponentBreakdown[];
    total: AdjustmentAmounts;
  };
}

export function needsAdjustmentPayment(startDate: string | Date, emiStartDate: string | Date): boolean {
  const loanStartDate = typeof startDate === 'string' ? isoToDate(startDate) : startDate;
  const emiStart = typeof emiStartDate === 'string' ? isoToDate(emiStartDate) : emiStartDate;
  const loanStartMonth = startOfMonth(loanStartDate);
  const emiStartMonth = startOfMonth(emiStart);

  return loanStartMonth.getTime() !== emiStartMonth.getTime() || getDate(loanStartDate) !== getDate(emiStart);
}

function getPartialPeriodRatio(loanStartDate: Date): {
  daysFromStart: number;
  daysInMonth: number;
  partialDaysRatio: number;
} {
  const monthEnd = endOfMonth(loanStartDate);
  const daysInMonth = differenceInDays(monthEnd, startOfMonth(loanStartDate)) + 1;
  const daysFromStart = differenceInDays(monthEnd, loanStartDate) + 1;
  const partialDaysRatio = daysFromStart / daysInMonth;

  return { daysFromStart, daysInMonth, partialDaysRatio };
}

function calculateProportionalAdjustment(
  outstandingPrincipal: number,
  monthlyRate: number,
  emiAmount: number,
  partialDaysRatio: number,
): AdjustmentAmounts {
  const partialInterest = Math.round(outstandingPrincipal * monthlyRate * partialDaysRatio * 100) / 100;
  const adjustmentAmount = Math.round(emiAmount * partialDaysRatio * 100) / 100;
  const adjustmentPrincipal = Math.max(0, Math.round((adjustmentAmount - partialInterest) * 100) / 100);
  const principal = Math.min(adjustmentPrincipal, outstandingPrincipal);

  return {
    principal,
    interest: partialInterest,
    total: principal + partialInterest,
  };
}

function calculateInterestOnlyAdjustment(
  outstandingPrincipal: number,
  monthlyRate: number,
  partialDaysRatio: number,
  rounding: InterestRoundingMode = 'round',
): AdjustmentAmounts {
  const raw = outstandingPrincipal * monthlyRate * partialDaysRatio;
  const interest = applyInterestRounding(raw, rounding);

  return {
    principal: 0,
    interest,
    total: interest,
  };
}

function resolveAdjustmentAmounts(
  adjustmentType: AdjustmentType,
  outstandingPrincipal: number,
  monthlyRate: number,
  emiAmount: number,
  partialDaysRatio: number,
  customPrincipal?: number,
  customInterest?: number,
  options?: {
    annualInterestRate?: number;
    daysFromStart?: number;
    loanComponents?: LoanComponentBreakdown[];
    interestRounding?: InterestRoundingMode;
  },
): { amounts: AdjustmentAmounts; components?: AdjustmentComponentBreakdown[] } {
  const loanComponents = options?.loanComponents;
  const hasSplit = loanComponents && loanComponents.length > 1;
  const daysFromStart = options?.daysFromStart ?? 0;
  const annualInterestRate = options?.annualInterestRate ?? monthlyRate * 12 * 100;
  const interestRounding = options?.interestRounding ?? 'round';

  if (adjustmentType === 'interest_only' && hasSplit && daysFromStart > 0) {
    const split = calculateSplitInterestOnlyAdjustment(
      loanComponents,
      annualInterestRate,
      daysFromStart,
      interestRounding,
    );
    return { amounts: split.total, components: split.components };
  }

  if (adjustmentType === 'proportional' && hasSplit) {
    const components: AdjustmentComponentBreakdown[] = loanComponents.map((component) => {
      const partialInterest = Math.round(component.principal * monthlyRate * partialDaysRatio * 100) / 100;
      const adjustmentAmount = Math.round(component.emiAmount * partialDaysRatio * 100) / 100;
      const principal = Math.min(
        Math.max(0, Math.round((adjustmentAmount - partialInterest) * 100) / 100),
        component.principal,
      );
      return { label: component.label, principal, interest: partialInterest };
    });

    const principal = components.reduce((sum, row) => sum + row.principal, 0);
    const interest = components.reduce((sum, row) => sum + row.interest, 0);

    return {
      amounts: { principal, interest, total: principal + interest },
      components,
    };
  }

  switch (adjustmentType) {
    case 'interest_only':
      return {
        amounts: calculateInterestOnlyAdjustment(outstandingPrincipal, monthlyRate, partialDaysRatio, interestRounding),
      };
    case 'custom': {
      const principal = Math.min(customPrincipal ?? 0, outstandingPrincipal);
      const interest = customInterest ?? 0;
      return {
        amounts: {
          principal,
          interest,
          total: principal + interest,
        },
      };
    }
    case 'proportional':
    default:
      return {
        amounts: calculateProportionalAdjustment(outstandingPrincipal, monthlyRate, emiAmount, partialDaysRatio),
      };
  }
}

/**
 * Preview adjustment options for the partial period between disbursement and first EMI.
 */
export function calculateAdjustmentPreview(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  startDate: string | Date,
  emiStartDate: string | Date,
  insuranceAmount?: number,
  interestRounding: InterestRoundingMode = 'round',
): AdjustmentPreview {
  const loanStartDate = typeof startDate === 'string' ? isoToDate(startDate) : startDate;
  const needsAdjustment = needsAdjustmentPayment(loanStartDate, emiStartDate);
  const totalPrincipal = principal + (insuranceAmount ?? 0);

  if (!needsAdjustment) {
    return {
      needsAdjustment: false,
      daysFromStart: 0,
      daysInMonth: 0,
      partialDaysRatio: 0,
      principal: 0,
      interest: 0,
      total: 0,
      proportional: { principal: 0, interest: 0, total: 0 },
      interestOnly: { principal: 0, interest: 0, total: 0 },
    };
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const emiAmount = calculateTotalLoanEMI(principal, insuranceAmount, annualInterestRate, tenureMonths);
  const { daysFromStart, daysInMonth, partialDaysRatio } = getPartialPeriodRatio(loanStartDate);
  const loanComponents = getLoanComponents({
    principal,
    insuranceAmount,
    interestRate: annualInterestRate,
    tenureMonths,
  });

  const proportional = resolveAdjustmentAmounts(
    'proportional',
    totalPrincipal,
    monthlyRate,
    emiAmount,
    partialDaysRatio,
    undefined,
    undefined,
    { loanComponents, annualInterestRate, daysFromStart, interestRounding },
  ).amounts;

  const interestOnly = resolveAdjustmentAmounts(
    'interest_only',
    totalPrincipal,
    monthlyRate,
    emiAmount,
    partialDaysRatio,
    undefined,
    undefined,
    { loanComponents, annualInterestRate, daysFromStart, interestRounding },
  ).amounts;

  const splitInterestOnly =
    hasInsuranceComponent({ insuranceAmount }) && daysFromStart > 0
      ? calculateSplitInterestOnlyAdjustment(loanComponents, annualInterestRate, daysFromStart, interestRounding)
      : undefined;

  return {
    needsAdjustment: true,
    daysFromStart,
    daysInMonth,
    partialDaysRatio,
    principal: proportional.principal,
    interest: proportional.interest,
    total: proportional.total,
    proportional,
    interestOnly: splitInterestOnly?.total ?? interestOnly,
    splitInterestOnly,
  };
}

export interface InterestVarianceExplanation {
  title: string;
  detail: string;
}

export interface InterestVarianceAnalysis {
  calculatedInterest: number;
  bankInterest: number;
  difference: number;
  calculatedPrincipal?: number;
  bankPrincipal?: number;
  principalDifference?: number;
  calculatedTotal?: number;
  bankTotal?: number;
  totalDifference?: number;
  explanations: InterestVarianceExplanation[];
}

/**
 * Reverse-engineer why a bank may have charged different partial-period amounts
 * than our formula (principal × monthlyRate × daysFromStart / daysInMonth).
 */
export function explainInterestVariance(
  principal: number,
  annualInterestRate: number,
  calculatedInterest: number,
  bankInterest: number,
  daysFromStart: number,
  daysInMonth: number,
  options?: {
    calculatedPrincipal?: number;
    bankPrincipal?: number;
  },
): InterestVarianceAnalysis | null {
  const bankPrincipal = options?.bankPrincipal ?? 0;
  const calculatedPrincipal = options?.calculatedPrincipal ?? 0;
  const bankTotal = bankInterest + bankPrincipal;
  const calculatedTotal = calculatedInterest + calculatedPrincipal;

  if (bankInterest <= 0 && bankPrincipal <= 0) {
    return null;
  }
  if (daysFromStart <= 0 || daysInMonth <= 0) {
    return null;
  }

  const interestDifference = Math.round((calculatedInterest - bankInterest) * 100) / 100;
  const principalDifference = Math.round((calculatedPrincipal - bankPrincipal) * 100) / 100;
  const totalDifference = Math.round((calculatedTotal - bankTotal) * 100) / 100;

  const hasInterestVariance = Math.abs(interestDifference) >= 1;
  const hasPrincipalVariance = bankPrincipal > 0 && Math.abs(principalDifference) >= 1;

  if (!hasInterestVariance && !hasPrincipalVariance) {
    return null;
  }

  const partialDaysRatio = daysFromStart / daysInMonth;
  const monthlyRate = annualInterestRate / 100 / 12;
  const impliedAnnualRate = Math.round((bankInterest / (principal * partialDaysRatio)) * 12 * 100 * 100) / 100;
  const impliedPrincipal = Math.round(bankInterest / (monthlyRate * partialDaysRatio));
  const principalDeduction = Math.round(principal - impliedPrincipal);

  const explanations: InterestVarianceExplanation[] = [];

  if (hasInterestVariance && Math.abs(impliedAnnualRate - annualInterestRate) >= 0.05) {
    explanations.push({
      title: 'Lower effective interest rate',
      detail: `Same ${daysFromStart}-day period on full principal implies ~${impliedAnnualRate.toFixed(2)}% p.a. instead of ${annualInterestRate.toFixed(2)}% for the ${formatCurrency(bankInterest)} interest portion.`,
    });
  }

  if (hasInterestVariance && principalDeduction > 1000) {
    explanations.push({
      title: 'Lower disbursed amount',
      detail: `Banks often charge interest on net disbursed amount. ~${formatCurrency(impliedPrincipal)} (about ${formatCurrency(principalDeduction)} less than entered principal) yields ~${formatCurrency(bankInterest)} interest.`,
    });
  }

  if (hasPrincipalVariance && bankPrincipal < calculatedPrincipal) {
    explanations.push({
      title: 'Minimal principal in broken period',
      detail: `Bank charged ${formatCurrency(bankPrincipal)} principal vs our proportional ${formatCurrency(calculatedPrincipal)}. Many banks collect mostly interest plus a small principal slice before the first full EMI.`,
    });
  }

  if (Math.abs(totalDifference) >= 1) {
    explanations.push({
      title: 'Total vs our estimates',
      detail: `Bank total ${formatCurrency(bankTotal)} (${formatCurrency(bankInterest)} interest + ${formatCurrency(bankPrincipal)} principal) vs our interest-only ${formatCurrency(calculatedInterest)} or proportional ${formatCurrency(calculatedTotal)}.`,
    });
  }

  if (hasInterestVariance) {
    explanations.push({
      title: 'Our interest formula',
      detail: `${formatCurrency(calculatedInterest)} = ${formatCurrency(principal)} × ${annualInterestRate}% ÷ 12 × ${daysFromStart}/${daysInMonth} (remaining days in disbursement month).`,
    });
  }

  return {
    calculatedInterest,
    bankInterest,
    difference: interestDifference,
    calculatedPrincipal,
    bankPrincipal,
    principalDifference,
    calculatedTotal,
    bankTotal,
    totalDifference,
    explanations,
  };
}

/**
 * Calculate standard EMI using the formula:
 * EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
 * where P = principal, r = monthly interest rate, n = number of months
 */
export function calculateEMI(principal: number, annualInterestRate: number, tenureMonths: number): number {
  if (tenureMonths === 0) return 0;

  const monthlyRate = annualInterestRate / 100 / 12;
  if (monthlyRate === 0) {
    return principal / tenureMonths;
  }

  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);

  return Math.round(emi * 100) / 100;
}

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
  const loanStartMonth = startOfMonth(loanStartDate);
  const emiStartMonth = startOfMonth(emiStart);
  const needsAdjustment = needsAdjustmentPayment(loanStartDate, emiStart);

  let emiCounter = 1;
  const adjustmentType = loan.adjustmentType ?? (isSplitLoan ? 'interest_only' : 'proportional');
  const shouldAddAdjustment = needsAdjustment && loan.emiStartDate && adjustmentType !== 'none';

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

  const regularEMIStartMonth =
    needsAdjustment && loan.emiStartDate ? startOfMonth(addMonths(loanStartMonth, 1)) : emiStartMonth;

  const emiDay = loan.emiStartDate ? getDate(isoToDate(loan.emiStartDate)) : getDate(emiStart);
  const totalRegularEMIs = loan.tenureMonths;

  for (let i = 0; i < totalRegularEMIs; i++) {
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

    const effectiveRate = modification?.newInterestRate ? modification.newInterestRate / 100 / 12 : monthlyRate;

    let principalComponent = 0;
    let interest = 0;

    if (isSplitLoan) {
      for (const component of componentBalances) {
        const componentInterest = Math.round(component.outstanding * effectiveRate * 100) / 100;
        const componentPrincipal = Math.round((component.emiAmount - componentInterest) * 100) / 100;
        const actualPrincipal = Math.min(componentPrincipal, component.outstanding);

        interest += componentInterest;
        principalComponent += actualPrincipal;
        component.outstanding = Math.round((component.outstanding - actualPrincipal) * 100) / 100;
      }
    } else {
      interest = Math.round(outstandingPrincipal * effectiveRate * 100) / 100;
      principalComponent = Math.round((loan.emiAmount - interest) * 100) / 100;
      const actualPrincipal = Math.min(principalComponent, outstandingPrincipal);
      principalComponent = actualPrincipal;
      outstandingPrincipal = Math.round((outstandingPrincipal - actualPrincipal) * 100) / 100;
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

/**
 * Recalculate EMI schedule after prepayment
 */
export function recalculateAfterPrepayment(
  loan: Loan,
  prepaymentAmount: number,
  prepaymentEMINumber: number,
  existingSchedule: EMIScheduleEntry[],
  reduceTenure: boolean = false,
): {
  updatedLoan: Loan;
  updatedSchedule: EMIScheduleEntry[];
} {
  // Find the EMI where prepayment is made
  const prepaymentEMI = existingSchedule.find((emi) => emi.emiNumber === prepaymentEMINumber);

  if (!prepaymentEMI) {
    throw new Error(`EMI number ${prepaymentEMINumber} not found`);
  }

  // Reduce outstanding principal
  let newOutstandingPrincipal = prepaymentEMI.outstandingPrincipal - prepaymentAmount;

  if (newOutstandingPrincipal < 0) {
    newOutstandingPrincipal = 0;
  }

  // Get remaining EMIs
  const remainingEMIs = existingSchedule.filter(
    (emi) => emi.emiNumber > prepaymentEMINumber && emi.status === 'pending',
  );

  if (remainingEMIs.length === 0) {
    // No remaining EMIs, just update the prepayment EMI
    const updatedSchedule = existingSchedule.map((emi) => {
      if (emi.emiNumber === prepaymentEMINumber) {
        return {
          ...emi,
          outstandingPrincipal: newOutstandingPrincipal,
        };
      }
      return emi;
    });

    return {
      updatedLoan: loan,
      updatedSchedule,
    };
  }

  // Recalculate remaining EMIs
  const monthlyRate = loan.interestRate / 100 / 12;
  let updatedLoan = { ...loan };

  if (reduceTenure) {
    // Reduce tenure - keep same EMI amount
    const newTenure = Math.ceil(
      -Math.log(1 - (newOutstandingPrincipal * monthlyRate) / loan.emiAmount) / Math.log(1 + monthlyRate),
    );
    updatedLoan = {
      ...loan,
      tenureMonths: prepaymentEMINumber + newTenure,
    };
  } else {
    // Reduce EMI amount - keep same tenure
    const remainingMonths = remainingEMIs.length;
    if (remainingMonths > 0 && monthlyRate > 0) {
      const newEMI =
        (newOutstandingPrincipal * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) /
        (Math.pow(1 + monthlyRate, remainingMonths) - 1);
      updatedLoan = {
        ...loan,
        emiAmount: Math.round(newEMI * 100) / 100,
      };
    }
  }

  // Regenerate schedule for remaining EMIs
  const updatedSchedule = [...existingSchedule];
  let currentOutstanding = newOutstandingPrincipal;

  for (const emi of remainingEMIs) {
    const interest = Math.round(currentOutstanding * monthlyRate * 100) / 100;
    const principal = Math.round((updatedLoan.emiAmount - interest) * 100) / 100;
    const actualPrincipal = Math.min(principal, currentOutstanding);
    const actualTotal = actualPrincipal + interest;

    currentOutstanding = Math.round((currentOutstanding - actualPrincipal) * 100) / 100;

    const index = updatedSchedule.findIndex((e) => e.id === emi.id);
    if (index !== -1) {
      updatedSchedule[index] = {
        ...emi,
        principal: actualPrincipal,
        interest,
        total: actualTotal,
        outstandingPrincipal: Math.max(0, currentOutstanding),
      };
    }
  }

  return {
    updatedLoan,
    updatedSchedule,
  };
}

/**
 * Apply step-up to EMI schedule
 */
export function applyStepUp(
  loan: Loan,
  stepUpAmount: number | null,
  stepUpPercentage: number | null,
  fromEMINumber: number,
  existingSchedule: EMIScheduleEntry[],
): {
  updatedLoan: Loan;
  updatedSchedule: EMIScheduleEntry[];
} {
  const currentEMI = loan.emiAmount;
  let newEMIAmount: number;

  if (stepUpAmount !== null) {
    newEMIAmount = currentEMI + stepUpAmount;
  } else if (stepUpPercentage !== null) {
    newEMIAmount = currentEMI * (1 + stepUpPercentage / 100);
  } else {
    throw new Error('Either stepUpAmount or stepUpPercentage must be provided');
  }

  newEMIAmount = Math.round(newEMIAmount * 100) / 100;

  // Update loan
  const updatedLoan = {
    ...loan,
    emiAmount: newEMIAmount,
  };

  // Update affected EMIs
  const updatedSchedule = existingSchedule.map((emi) => {
    if (emi.emiNumber >= fromEMINumber && emi.status === 'pending') {
      const monthlyRate = loan.interestRate / 100 / 12;
      const interest = Math.round(emi.outstandingPrincipal * monthlyRate * 100) / 100;
      const principal = Math.round((newEMIAmount - interest) * 100) / 100;
      const actualPrincipal = Math.min(principal, emi.outstandingPrincipal);
      const actualTotal = actualPrincipal + interest;

      const newOutstanding = Math.round((emi.outstandingPrincipal - actualPrincipal) * 100) / 100;

      return {
        ...emi,
        principal: actualPrincipal,
        interest,
        total: actualTotal,
        outstandingPrincipal: Math.max(0, newOutstanding),
      };
    }
    return emi;
  });

  // Recalculate outstanding principal for subsequent EMIs
  let currentOutstanding = updatedSchedule.find((e) => e.emiNumber === fromEMINumber)?.outstandingPrincipal || 0;

  for (let i = fromEMINumber + 1; i <= loan.tenureMonths; i++) {
    const emi = updatedSchedule.find((e) => e.emiNumber === i);
    if (emi && emi.status === 'pending') {
      const monthlyRate = loan.interestRate / 100 / 12;
      const interest = Math.round(currentOutstanding * monthlyRate * 100) / 100;
      const principal = Math.round((newEMIAmount - interest) * 100) / 100;
      const actualPrincipal = Math.min(principal, currentOutstanding);
      const actualTotal = actualPrincipal + interest;

      currentOutstanding = Math.round((currentOutstanding - actualPrincipal) * 100) / 100;

      const index = updatedSchedule.findIndex((e) => e.id === emi.id);
      if (index !== -1) {
        updatedSchedule[index] = {
          ...emi,
          principal: actualPrincipal,
          interest,
          total: actualTotal,
          outstandingPrincipal: Math.max(0, currentOutstanding),
        };
      }
    }
  }

  return {
    updatedLoan,
    updatedSchedule,
  };
}

function recalculateEMIComponents(
  outstandingPrincipal: number,
  emiAmount: number,
  annualInterestRate: number,
): {
  interest: number;
  principal: number;
  total: number;
  outstandingPrincipal: number;
} {
  const monthlyRate = annualInterestRate / 100 / 12;
  const interest = Math.round(outstandingPrincipal * monthlyRate * 100) / 100;
  const principal = Math.round((emiAmount - interest) * 100) / 100;
  const actualPrincipal = Math.min(principal, outstandingPrincipal);
  const total = actualPrincipal + interest;
  const nextOutstanding = Math.round((outstandingPrincipal - actualPrincipal) * 100) / 100;

  return {
    interest,
    principal: actualPrincipal,
    total,
    outstandingPrincipal: Math.max(0, nextOutstanding),
  };
}

/**
 * Recalculate EMI schedule after an interest rate change
 */
export function recalculateInterestRate(
  loan: Loan,
  newInterestRate: number,
  affectedEMIs: number[],
  existingSchedule: EMIScheduleEntry[],
): EMIScheduleEntry[] {
  const updatedSchedule = [...existingSchedule];
  const firstAffectedIndex = updatedSchedule.findIndex(
    (emi) => affectedEMIs.includes(emi.emiNumber) && emi.status === 'pending',
  );

  if (firstAffectedIndex === -1) {
    return updatedSchedule;
  }

  let currentOutstanding = updatedSchedule[firstAffectedIndex].outstandingPrincipal;

  for (let index = firstAffectedIndex; index < updatedSchedule.length; index++) {
    const emi = updatedSchedule[index];
    if (!affectedEMIs.includes(emi.emiNumber) || emi.status !== 'pending') {
      continue;
    }

    const recalculated = recalculateEMIComponents(currentOutstanding, loan.emiAmount, newInterestRate);
    currentOutstanding = recalculated.outstandingPrincipal;

    updatedSchedule[index] = {
      ...emi,
      interest: recalculated.interest,
      principal: recalculated.principal,
      total: recalculated.total,
      outstandingPrincipal: recalculated.outstandingPrincipal,
      modifiedInterestRate: newInterestRate,
    };
  }

  return updatedSchedule;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(getNumberLocale(), {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
