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
  EmiPostingOrder,
  InterestAccrualMethod,
  InterestRoundingMode,
  Loan,
  LoanModification,
  MoratoriumRateChange,
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

/** First-month interest on the total principal — minimum viable fixed EMI */
export function calculateMinimumFixedEMI(
  principal: number,
  insuranceAmount: number | undefined,
  annualInterestRate: number,
): number {
  const totalPrincipal = principal + (insuranceAmount ?? 0);
  const monthlyRate = annualInterestRate / 100 / 12;
  return Math.round(totalPrincipal * monthlyRate * 100) / 100;
}

/**
 * Estimate how many months it takes to repay at a fixed EMI.
 * Interest is calculated on the reducing balance; principal = EMI − interest.
 */
export function calculateTenureFromFixedEMI(
  principal: number,
  insuranceAmount: number | undefined,
  annualInterestRate: number,
  fixedEmi: number,
  maxMonths: number = 600,
): number {
  const totalPrincipal = principal + (insuranceAmount ?? 0);
  if (totalPrincipal <= 0 || fixedEmi <= 0) return 0;

  const monthlyRate = annualInterestRate / 100 / 12;
  let outstanding = totalPrincipal;
  let months = 0;

  while (outstanding > 0.01 && months < maxMonths) {
    const interest = Math.round(outstanding * monthlyRate * 100) / 100;
    if (fixedEmi <= interest) {
      return maxMonths;
    }
    const principalPayment = Math.min(Math.round((fixedEmi - interest) * 100) / 100, outstanding);
    outstanding = Math.round((outstanding - principalPayment) * 100) / 100;
    months++;
  }

  return months;
}

export function resolveLoanEmiAmount(
  loan: Pick<Loan, 'principal' | 'insuranceAmount' | 'interestRate' | 'tenureMonths' | 'emiCalculationMode'> & {
    emiAmount?: number;
  },
  fixedEmiAmount?: number,
): number {
  if (loan.emiCalculationMode === 'fixed') {
    const amount = fixedEmiAmount ?? loan.emiAmount;
    if (amount !== undefined && amount > 0) {
      return amount;
    }
  }

  return calculateTotalLoanEMI(loan.principal, loan.insuranceAmount, loan.interestRate, loan.tenureMonths);
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

export function resolveInterestAccrualMethod(loan: Pick<Loan, 'type' | 'interestAccrualMethod' | 'startDate' | 'emiStartDate'>): InterestAccrualMethod {
  if (loan.interestAccrualMethod) {
    return loan.interestAccrualMethod;
  }
  if (
    loan.type === 'education' &&
    loan.emiStartDate &&
    hasMoratoriumPeriod(loan.startDate, loan.emiStartDate)
  ) {
    return 'actual_365';
  }
  return 'monthly_reducing';
}

export function resolveEmiPostingOrder(loan: Pick<Loan, 'type' | 'emiPostingOrder' | 'startDate' | 'emiStartDate'>): EmiPostingOrder {
  if (loan.emiPostingOrder) {
    return loan.emiPostingOrder;
  }
  if (loan.type === 'education') {
    return 'emi_first';
  }
  return 'standard';
}

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

function calculateRepaymentComponents(
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

/** Effective annual rate at a given date, applying moratorium rate changes chronologically. */
export function getEffectiveMoratoriumRate(
  date: Date,
  baseRate: number,
  rateChanges: MoratoriumRateChange[],
): number {
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
function generateMoratoriumSchedule(loan: Loan): { entries: EMIScheduleEntry[]; endOutstanding: number } {
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
  const emiStartMonth = startOfMonth(emiStart);
  const isMoratoriumLoan = hasMoratoriumPeriod(loanStartDate, emiStart);
  const needsPartialAdjustment = isShortPartialPeriodGap(loanStartDate, emiStart);
  const rounding = loan.interestRounding ?? 'round';
  const accrualMethod = resolveInterestAccrualMethod(loan);
  const postingOrder = resolveEmiPostingOrder(loan);

  let emiCounter = 1;
  const adjustmentType = loan.adjustmentType ?? (isSplitLoan ? 'interest_only' : 'proportional');
  const shouldAddAdjustment = needsPartialAdjustment && loan.emiStartDate && adjustmentType !== 'none';

  if (isMoratoriumLoan && (loan.disbursedPrincipal !== undefined || (loan.disbursements?.length ?? 0) > 0 || (loan.moratoriumRateChanges?.length ?? 0) > 0)) {
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
    // Reduce EMI amount - keep same tenure (unless user has a fixed bank-stated EMI)
    if (loan.emiCalculationMode === 'fixed') {
      updatedLoan = { ...loan };
    } else {
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
    (emi) => affectedEMIs.includes(emi.emiNumber) && emi.status === 'pending' && !emi.isMoratorium,
  );

  if (firstAffectedIndex === -1) {
    return updatedSchedule;
  }

  const postingOrder = resolveEmiPostingOrder(loan);
  const accrualMethod = resolveInterestAccrualMethod(loan);
  const rounding = loan.interestRounding ?? 'round';

  const previousRepaymentEntry = updatedSchedule
    .slice(0, firstAffectedIndex)
    .reverse()
    .find((entry) => !entry.isMoratorium || entry.emiNumber > 0);

  let currentOutstanding = previousRepaymentEntry
    ? previousRepaymentEntry.outstandingPrincipal
    : updatedSchedule[firstAffectedIndex].outstandingPrincipal + updatedSchedule[firstAffectedIndex].principal;

  for (let index = firstAffectedIndex; index < updatedSchedule.length; index++) {
    const emi = updatedSchedule[index];
    if (!affectedEMIs.includes(emi.emiNumber) || emi.status !== 'pending' || emi.isMoratorium) {
      continue;
    }

    const monthDate = isoToDate(emi.dueDate);
    const recalculated = calculateRepaymentComponents(
      currentOutstanding,
      loan.emiAmount,
      newInterestRate,
      monthDate,
      postingOrder,
      accrualMethod,
      rounding,
    );
    currentOutstanding = recalculated.closingBalance;

    updatedSchedule[index] = {
      ...emi,
      interest: recalculated.interest,
      principal: recalculated.principal,
      total: recalculated.total,
      outstandingPrincipal: recalculated.closingBalance,
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
