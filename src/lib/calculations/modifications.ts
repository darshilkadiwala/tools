import { isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry, Loan } from '@/types';

import {
  calculateRepaymentComponents,
  resolveEmiPostingOrder,
  resolveInterestAccrualMethod,
} from './moratorium';

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
