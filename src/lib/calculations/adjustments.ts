import { addMonths, differenceInDays, endOfMonth, getDate, isBefore, startOfMonth } from 'date-fns';

import { isoToDate } from '@/lib/utils';

import type { AdjustmentType, InterestRoundingMode } from '@/types';

import {
  applyInterestRounding,
  calculateActual365Interest,
  calculateTotalLoanEMI,
  formatCurrency,
  getLoanComponents,
  hasInsuranceComponent,
} from './emi-formula';
import type {
  AdjustmentAmounts,
  AdjustmentComponentBreakdown,
  AdjustmentPreview,
  InterestVarianceAnalysis,
  InterestVarianceExplanation,
  LoanComponentBreakdown,
} from './types';

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

export function needsAdjustmentPayment(startDate: string | Date, emiStartDate: string | Date): boolean {
  return isShortPartialPeriodGap(startDate, emiStartDate);
}

/**
 * True when the first EMI falls in the same month as disbursement (different day)
 * or in the month immediately after — the classic broken-period case.
 */
export function isShortPartialPeriodGap(startDate: string | Date, emiStartDate: string | Date): boolean {
  const loanStartDate = typeof startDate === 'string' ? isoToDate(startDate) : startDate;
  const emiStart = typeof emiStartDate === 'string' ? isoToDate(emiStartDate) : emiStartDate;

  if (isBefore(emiStart, loanStartDate)) {
    return false;
  }

  const loanStartMonth = startOfMonth(loanStartDate);
  const emiStartMonth = startOfMonth(emiStart);

  if (loanStartMonth.getTime() === emiStartMonth.getTime()) {
    return getDate(loanStartDate) !== getDate(emiStart);
  }

  const monthAfterDisbursement = startOfMonth(addMonths(loanStartMonth, 1));
  return emiStartMonth.getTime() === monthAfterDisbursement.getTime();
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

export function resolveAdjustmentAmounts(
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

export { getPartialPeriodRatio };
