import { useCallback } from 'react';

import { applyStepUp as applyStepUpCalculation, recalculateAfterPrepayment } from '@/lib/calculations';
import { db } from '@/lib/db';
import { dateToISO, generateUUID } from '@/lib/utils';

import type { LoanModification } from '@/types';

import { useLoans } from './useLoans';

export function useLoanOperations() {
  const { updateLoan, refreshLoans } = useLoans();

  const applyPrepayment = useCallback(
    async (loanId: string, prepaymentAmount: number, prepaymentEMINumber: number, reduceTenure: boolean = false) => {
      try {
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

        // Update loan
        await updateLoan(loanId, updatedLoan);

        // Update EMI schedules
        for (const emi of updatedSchedule) {
          await db.emiSchedules.update(emi.id, emi);
        }

        // Record modification
        const modification: LoanModification = {
          id: generateUUID(),
          loanId,
          type: 'prepayment',
          date: dateToISO(new Date()),
          amount: prepaymentAmount,
          affectedEMIs: [prepaymentEMINumber],
        };
        await db.modifications.add(modification);

        await refreshLoans();
        return { updatedLoan, updatedSchedule };
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to apply prepayment');
      }
    },
    [updateLoan, refreshLoans],
  );

  const applyStepUp = useCallback(
    async (loanId: string, stepUpAmount: number | null, stepUpPercentage: number | null, fromEMINumber: number) => {
      try {
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

        // Update loan
        await updateLoan(loanId, updatedLoan);

        // Update EMI schedules
        for (const emi of updatedSchedule) {
          await db.emiSchedules.update(emi.id, emi);
        }

        // Record modification
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
        await db.modifications.add(modification);

        await refreshLoans();
        return { updatedLoan, updatedSchedule };
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to apply step-up');
      }
    },
    [updateLoan, refreshLoans],
  );

  const changeInterestRate = useCallback(
    async (loanId: string, newInterestRate: number, affectedEMINumbers: number[] | 'all') => {
      try {
        const loan = await db.loans.get(loanId);
        if (!loan) {
          throw new Error('Loan not found');
        }

        const existingSchedule = await db.emiSchedules.where('loanId').equals(loanId).toArray();

        let affectedEMIs: number[];
        if (affectedEMINumbers === 'all') {
          affectedEMIs = existingSchedule.filter((emi) => emi.status === 'pending').map((emi) => emi.emiNumber);
        } else {
          affectedEMIs = affectedEMINumbers;
        }

        // Update affected EMIs
        const updatedSchedule = existingSchedule.map((emi) => {
          if (affectedEMIs.includes(emi.emiNumber) && emi.status === 'pending') {
            const monthlyRate = newInterestRate / 100 / 12;
            const interest = Math.round(emi.outstandingPrincipal * monthlyRate * 100) / 100;
            const principal = Math.round((loan.emiAmount - interest) * 100) / 100;
            const actualPrincipal = Math.min(principal, emi.outstandingPrincipal);
            const actualTotal = actualPrincipal + interest;

            // Recalculate outstanding for subsequent EMIs
            const currentOutstanding = emi.outstandingPrincipal - actualPrincipal;

            return {
              ...emi,
              interest,
              principal: actualPrincipal,
              total: actualTotal,
              outstandingPrincipal: Math.max(0, currentOutstanding),
              modifiedInterestRate: newInterestRate,
            };
          }
          return emi;
        });

        // Recalculate subsequent EMIs
        for (let i = 0; i < updatedSchedule.length; i++) {
          const emi = updatedSchedule[i];
          if (affectedEMIs.includes(emi.emiNumber) && emi.status === 'pending') {
            let currentOutstanding = emi.outstandingPrincipal;

            for (let j = i + 1; j < updatedSchedule.length; j++) {
              const nextEMI = updatedSchedule[j];
              if (nextEMI.status === 'pending') {
                const monthlyRate = newInterestRate / 100 / 12;
                const interest = Math.round(currentOutstanding * monthlyRate * 100) / 100;
                const principal = Math.round((loan.emiAmount - interest) * 100) / 100;
                const actualPrincipal = Math.min(principal, currentOutstanding);
                const actualTotal = actualPrincipal + interest;

                currentOutstanding = Math.round((currentOutstanding - actualPrincipal) * 100) / 100;

                updatedSchedule[j] = {
                  ...nextEMI,
                  interest,
                  principal: actualPrincipal,
                  total: actualTotal,
                  outstandingPrincipal: Math.max(0, currentOutstanding),
                  modifiedInterestRate: newInterestRate,
                };
              }
            }
            break;
          }
        }

        // Update EMI schedules in database
        for (const emi of updatedSchedule) {
          await db.emiSchedules.update(emi.id, emi);
        }

        // Record modification
        const modification: LoanModification = {
          id: generateUUID(),
          loanId,
          type: 'interest_change',
          date: dateToISO(new Date()),
          newInterestRate,
          affectedEMIs,
        };
        await db.modifications.add(modification);

        await refreshLoans();
        return { updatedSchedule };
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to change interest rate');
      }
    },
    [refreshLoans],
  );

  return {
    applyPrepayment,
    applyStepUp,
    changeInterestRate,
  };
}
