import { useCallback } from 'react';

import { useLoanContext } from '@/contexts/LoanContext';
import {
  applyStepUp as applyStepUpCalculation,
  recalculateAfterPrepayment,
  recalculateInterestRate,
} from '@/lib/calculations';
import { db } from '@/lib/db';
import { addModification, bulkUpdateEMISchedules } from '@/lib/db-operations';
import { dateToISO, generateUUID } from '@/lib/utils';

import type { EMIScheduleEntry, Loan, LoanModification } from '@/types';

export function useLoanOperations(): {
  applyPrepayment: (
    loanId: string,
    prepaymentAmount: number,
    prepaymentEMINumber: number,
    reduceTenure?: boolean,
  ) => Promise<{ updatedLoan: Loan; updatedSchedule: EMIScheduleEntry[] }>;
  applyStepUp: (
    loanId: string,
    stepUpAmount: number | null,
    stepUpPercentage: number | null,
    fromEMINumber: number,
  ) => Promise<{ updatedLoan: Loan; updatedSchedule: EMIScheduleEntry[] }>;
  changeInterestRate: (
    loanId: string,
    newInterestRate: number,
    affectedEMINumbers: number[] | 'all',
  ) => Promise<{ updatedSchedule: EMIScheduleEntry[] }>;
} {
  const { loans } = useLoanContext();
  const { updateLoan } = loans;

  const applyPrepayment = useCallback(
    async (loanId: string, prepaymentAmount: number, prepaymentEMINumber: number, reduceTenure: boolean = false) => {
      const loan = await db.loans.get(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      const existingSchedule = await db.emiSchedules.where('loanId').equals(loanId).toArray();
      const { updatedLoan, updatedSchedule } = recalculateAfterPrepayment(
        loan,
        prepaymentAmount,
        prepaymentEMINumber,
        existingSchedule,
        reduceTenure,
      );

      await updateLoan(loanId, updatedLoan);
      await bulkUpdateEMISchedules(updatedSchedule);

      const modification: LoanModification = {
        id: generateUUID(),
        loanId,
        type: 'prepayment',
        date: dateToISO(new Date()),
        amount: prepaymentAmount,
        affectedEMIs: [prepaymentEMINumber],
      };
      await addModification(modification);

      return { updatedLoan, updatedSchedule };
    },
    [updateLoan],
  );

  const applyStepUp = useCallback(
    async (loanId: string, stepUpAmount: number | null, stepUpPercentage: number | null, fromEMINumber: number) => {
      const loan = await db.loans.get(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      const existingSchedule = await db.emiSchedules.where('loanId').equals(loanId).toArray();
      const { updatedLoan, updatedSchedule } = applyStepUpCalculation(
        loan,
        stepUpAmount,
        stepUpPercentage,
        fromEMINumber,
        existingSchedule,
      );

      await updateLoan(loanId, updatedLoan);
      await bulkUpdateEMISchedules(updatedSchedule);

      const affectedEMIs = existingSchedule
        .filter((emi) => emi.emiNumber >= fromEMINumber && emi.status === 'pending')
        .map((emi) => emi.emiNumber);

      const modification: LoanModification = {
        id: generateUUID(),
        loanId,
        type: 'stepup',
        date: dateToISO(new Date()),
        amount: stepUpAmount || undefined,
        percentage: stepUpPercentage || undefined,
        affectedEMIs,
      };
      await addModification(modification);

      return { updatedLoan, updatedSchedule };
    },
    [updateLoan],
  );

  const changeInterestRate = useCallback(
    async (loanId: string, newInterestRate: number, affectedEMINumbers: number[] | 'all') => {
      const loan = await db.loans.get(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      const existingSchedule = await db.emiSchedules.where('loanId').equals(loanId).toArray();
      const affectedEMIs =
        affectedEMINumbers === 'all'
          ? existingSchedule.filter((emi) => emi.status === 'pending').map((emi) => emi.emiNumber)
          : affectedEMINumbers;

      const updatedSchedule = recalculateInterestRate(loan, newInterestRate, affectedEMIs, existingSchedule);
      await bulkUpdateEMISchedules(updatedSchedule);

      const modification: LoanModification = {
        id: generateUUID(),
        loanId,
        type: 'interest_change',
        date: dateToISO(new Date()),
        newInterestRate,
        affectedEMIs,
      };
      await addModification(modification);

      return { updatedSchedule };
    },
    [],
  );

  return {
    applyPrepayment,
    applyStepUp,
    changeInterestRate,
  };
}
