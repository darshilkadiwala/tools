import {
  addDays,
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
  MoratoriumInterestMode,
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

export function resolveMoratoriumInterestMode(
  loan: Pick<Loan, 'type' | 'moratoriumInterestMode' | 'startDate' | 'emiStartDate'>,
): MoratoriumInterestMode {
  if (loan.moratoriumInterestMode) {
    return loan.moratoriumInterestMode;
  }
  if (loan.type === 'education' && loan.emiStartDate && hasMoratoriumPeriod(loan.startDate, loan.emiStartDate)) {
    return 'simple_on_disbursements';
  }
  return 'compound_on_outstanding';
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

/** Interest for a sub-period within a month, splitting when a rate change occurs mid-period. */
function calculateMoratoriumPeriodInterest(
  outstanding: number,
  baseRate: number,
  rateChanges: MoratoriumRateChange[],
  periodStart: Date,
  periodEnd: Date,
  accrualMethod: InterestAccrualMethod,
  rounding: InterestRoundingMode,
): number {
  if (outstanding <= 0 || isAfter(periodStart, periodEnd)) {
    return 0;
  }

  const days = differenceInDays(periodEnd, periodStart) + 1;
  if (days <= 0) {
    return 0;
  }

  if (accrualMethod !== 'actual_365') {
    const rate = getEffectiveMoratoriumRate(periodEnd, baseRate, rateChanges);
    const daysInMonth = getDaysInMonth(periodStart);
    return applyInterestRounding(outstanding * (rate / 100 / 12) * (days / daysInMonth), rounding);
  }

  const changesInPeriod = [...rateChanges]
    .filter((change) => {
      const changeDate = isoToDate(change.date);
      return !isBefore(changeDate, periodStart) && !isAfter(changeDate, periodEnd);
    })
    .sort((a, b) => isoToDate(a.date).getTime() - isoToDate(b.date).getTime());

  if (changesInPeriod.length === 0) {
    const rate = getEffectiveMoratoriumRate(periodEnd, baseRate, rateChanges);
    return calculateActual365Interest(outstanding, rate, days, rounding);
  }

  let interest = 0;
  let cursor = periodStart;
  let currentRate = getEffectiveMoratoriumRate(periodStart, baseRate, rateChanges);

  for (const change of changesInPeriod) {
    const changeDate = isoToDate(change.date);
    const daysBeforeChange = differenceInDays(changeDate, cursor);
    if (daysBeforeChange > 0) {
      interest += calculateActual365Interest(outstanding, currentRate, daysBeforeChange, rounding);
    }
    cursor = changeDate;
    currentRate = change.newInterestRate;
  }

  const daysRemaining = differenceInDays(periodEnd, cursor) + 1;
  interest += calculateActual365Interest(outstanding, currentRate, daysRemaining, rounding);

  return interest;
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
  const appliedRate = getEffectiveMoratoriumRate(monthEnd, baseRate, rateChanges);

  return {
    interest: calculateMoratoriumPeriodInterest(
      outstanding,
      baseRate,
      rateChanges,
      monthStart,
      monthEnd,
      accrualMethod,
      rounding,
    ),
    appliedRate,
  };
}

interface DisbursementInMonth {
  date: string;
  amount: number;
}

/**
 * SBI-style moratorium interest: simple interest on each disbursed tranche for the days
 * that tranche is outstanding within the calendar month. Capitalized interest does not
 * earn further interest during the study period.
 */
export function calculateSimpleMoratoriumMonthInterest(
  disbursements: DisbursementInMonth[],
  baseRate: number,
  rateChanges: MoratoriumRateChange[],
  monthDate: Date,
  accrualMethod: InterestAccrualMethod,
  rounding: InterestRoundingMode,
): { interest: number; appliedRate: number } {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  let totalInterest = 0;

  for (const disb of disbursements) {
    const disbDate = isoToDate(disb.date);
    if (isAfter(disbDate, monthEnd)) {
      continue;
    }

    const periodStart = isBefore(disbDate, monthStart) ? monthStart : disbDate;
    if (isAfter(periodStart, monthEnd)) {
      continue;
    }

    totalInterest += calculateMoratoriumPeriodInterest(
      disb.amount,
      baseRate,
      rateChanges,
      periodStart,
      monthEnd,
      accrualMethod,
      rounding,
    );
  }

  const appliedRate = getEffectiveMoratoriumRate(monthEnd, baseRate, rateChanges);

  return {
    interest: Math.round(totalInterest * 100) / 100,
    appliedRate,
  };
}

/**
 * Monthly moratorium interest when tranches land mid-month.
 * Accrues on the opening balance until each disbursement date, then on the updated balance through month-end.
 */
export function calculateMoratoriumMonthInterestWithDisbursements(
  openingBalance: number,
  disbursementsThisMonth: DisbursementInMonth[],
  baseRate: number,
  rateChanges: MoratoriumRateChange[],
  monthDate: Date,
  accrualMethod: InterestAccrualMethod,
  rounding: InterestRoundingMode,
): { interest: number; appliedRate: number } {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const sortedDisbs = [...disbursementsThisMonth].sort(
    (a, b) => isoToDate(a.date).getTime() - isoToDate(b.date).getTime(),
  );
  const hasMidMonthDisb = sortedDisbs.some((disb) => getDate(isoToDate(disb.date)) > 1);

  if (!hasMidMonthDisb) {
    let balance = openingBalance;
    for (const disb of sortedDisbs) {
      balance = Math.round((balance + disb.amount) * 100) / 100;
    }
    return calculateMoratoriumMonthInterest(balance, baseRate, rateChanges, monthDate, accrualMethod, rounding);
  }

  let balance = openingBalance;
  let totalInterest = 0;
  let periodStart = monthStart;

  for (const disb of sortedDisbs) {
    const disbDate = isoToDate(disb.date);
    const daysBeforeDisb = differenceInDays(disbDate, periodStart);

    if (balance > 0 && daysBeforeDisb > 0) {
      totalInterest += calculateMoratoriumPeriodInterest(
        balance,
        baseRate,
        rateChanges,
        periodStart,
        addDays(disbDate, -1),
        accrualMethod,
        rounding,
      );
    }

    balance = Math.round((balance + disb.amount) * 100) / 100;
    periodStart = disbDate;
  }

  if (balance > 0) {
    totalInterest += calculateMoratoriumPeriodInterest(
      balance,
      baseRate,
      rateChanges,
      periodStart,
      monthEnd,
      accrualMethod,
      rounding,
    );
  }

  const appliedRate = getEffectiveMoratoriumRate(monthEnd, baseRate, rateChanges);

  return {
    interest: Math.round(totalInterest * 100) / 100,
    appliedRate,
  };
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
  const moratoriumInterestMode = resolveMoratoriumInterestMode(loan);

  const sortedDisbursements = [...(loan.disbursements ?? [])].sort(
    (a, b) => isoToDate(a.date).getTime() - isoToDate(b.date).getTime(),
  );

  const hasTranches = sortedDisbursements.length > 0;
  let outstanding = hasTranches ? 0 : (loan.disbursedPrincipal ?? 0);
  const disbursementsForInterest: DisbursementInMonth[] = hasTranches
    ? sortedDisbursements
    : loan.disbursedPrincipal
      ? [{ date: loan.startDate, amount: loan.disbursedPrincipal }]
      : [];

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
        entryKind: 'disbursement',
        emiNumber: appliedDisbursementCount,
        dueDate: dateToISO(disbDate),
        principal: disb.amount,
        interest: 0,
        total: disb.amount,
        outstandingPrincipal: outstanding,
        status: getEMIStatus(disbDate),
        isMoratorium: true,
        isDisbursement: true,
        disbursementLabel: disb.label,
        modifiedInterestRate: getEffectiveMoratoriumRate(disbDate, loan.interestRate, rateChanges),
      });
    }

    const { interest, appliedRate } =
      moratoriumInterestMode === 'simple_on_disbursements'
        ? calculateSimpleMoratoriumMonthInterest(
            disbursementsForInterest,
            loan.interestRate,
            rateChanges,
            cursor,
            accrualMethod,
            rounding,
          )
        : calculateMoratoriumMonthInterestWithDisbursements(
            balanceBeforeDisbs,
            disbsThisMonth,
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
        entryKind: 'moratorium',
        emiNumber: moratoriumCounter,
        dueDate: dateToISO(monthEnd),
        principal: 0,
        interest,
        total: interest,
        outstandingPrincipal: outstanding,
        status: getEMIStatus(monthEnd),
        isMoratorium: true,
        modifiedInterestRate: appliedRate,
      });
      moratoriumCounter++;
    }

    cursor = addMonths(cursor, 1);
  }

  entries.sort((a, b) => isoToDate(a.dueDate).getTime() - isoToDate(b.dueDate).getTime());

  return { entries, endOutstanding: outstanding };
}
