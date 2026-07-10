import { useCallback, useEffect, useState } from 'react';

import { calculateTotalLoanEMI, resolveLoanEmiAmount } from '@/lib/calculations';
import { createLoan as createLoanRecord, deleteLoanData, getAllLoans, getLoanById, saveLoan } from '@/lib/db';
import { dateToISO, generateUUID } from '@/lib/utils';

import type { Loan } from '@/types';

export function useLoans(): {
  loans: Loan[];
  loading: boolean;
  error: Error | null;
  createLoan: (
    loanData: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'> & { fixedEmiAmount?: number },
  ) => Promise<Loan>;
  updateLoan: (id: string, updates: Partial<Loan> & { fixedEmiAmount?: number }) => Promise<Loan>;
  deleteLoan: (id: string) => Promise<void>;
  getLoan: (id: string) => Promise<Loan | undefined>;
  refreshLoans: () => Promise<void>;
} {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadLoans = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const allLoans = await getAllLoans();
      setLoans(allLoans);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load loans'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  const createLoan = useCallback(
    async (
      loanData: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'> & { fixedEmiAmount?: number },
    ): Promise<Loan> => {
      const { fixedEmiAmount, ...rest } = loanData;
      const emiAmount = resolveLoanEmiAmount(rest, fixedEmiAmount);
      const newLoan: Loan = {
        ...rest,
        id: generateUUID(),
        emiAmount,
        createdAt: dateToISO(new Date()),
        updatedAt: dateToISO(new Date()),
      };

      await createLoanRecord(newLoan);
      setLoans((currentLoans) => [...currentLoans, newLoan]);
      return newLoan;
    },
    [],
  );

  const updateLoan = useCallback(
    async (id: string, updates: Partial<Loan> & { fixedEmiAmount?: number }): Promise<Loan> => {
      const { fixedEmiAmount, ...loanUpdates } = updates;
      const existingLoan = await getLoanById(id);
      if (!existingLoan) {
        throw new Error('Loan not found');
      }

      const updatedLoan: Loan = {
        ...existingLoan,
        ...loanUpdates,
        updatedAt: dateToISO(new Date()),
      };

      if (updatedLoan.emiCalculationMode === 'fixed') {
        if (fixedEmiAmount !== undefined && fixedEmiAmount > 0) {
          updatedLoan.emiAmount = fixedEmiAmount;
        }
      } else if (loanUpdates.emiCalculationMode === 'formula') {
        updatedLoan.emiAmount = calculateTotalLoanEMI(
          updatedLoan.principal,
          updatedLoan.insuranceAmount,
          updatedLoan.interestRate,
          updatedLoan.tenureMonths,
        );
      } else if (
        existingLoan.emiCalculationMode !== 'fixed' &&
        loanUpdates.emiCalculationMode !== 'fixed' &&
        (loanUpdates.principal !== undefined ||
          loanUpdates.insuranceAmount !== undefined ||
          loanUpdates.interestRate !== undefined ||
          loanUpdates.tenureMonths !== undefined)
      ) {
        updatedLoan.emiAmount = calculateTotalLoanEMI(
          updatedLoan.principal,
          updatedLoan.insuranceAmount,
          updatedLoan.interestRate,
          updatedLoan.tenureMonths,
        );
      }

      await saveLoan(updatedLoan);
      setLoans((currentLoans) => currentLoans.map((loan) => (loan.id === id ? updatedLoan : loan)));
      return updatedLoan;
    },
    [],
  );

  const deleteLoan = useCallback(async (id: string): Promise<void> => {
    await deleteLoanData(id);
    setLoans((currentLoans) => currentLoans.filter((loan) => loan.id !== id));
  }, []);

  const getLoan = useCallback(async (id: string): Promise<Loan | undefined> => {
    return getLoanById(id);
  }, []);

  return {
    loans,
    loading,
    error,
    createLoan,
    updateLoan,
    deleteLoan,
    getLoan,
    refreshLoans: loadLoans,
  };
}
