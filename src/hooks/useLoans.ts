import { useCallback, useEffect, useState } from 'react';

import { calculateTotalLoanEMI } from '@/lib/calculations';
import { db } from '@/lib/db';
import { deleteLoanData } from '@/lib/db-operations';
import { dateToISO, generateUUID } from '@/lib/utils';

import type { Loan } from '@/types';

export function useLoans(): {
  loans: Loan[];
  loading: boolean;
  error: Error | null;
  createLoan: (loanData: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>) => Promise<Loan>;
  updateLoan: (id: string, updates: Partial<Loan>) => Promise<Loan>;
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
      const allLoans = await db.loans.toArray();
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
    async (loanData: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>): Promise<Loan> => {
      const emiAmount = calculateTotalLoanEMI(
        loanData.principal,
        loanData.insuranceAmount,
        loanData.interestRate,
        loanData.tenureMonths,
      );
      const newLoan: Loan = {
        ...loanData,
        id: generateUUID(),
        emiAmount,
        createdAt: dateToISO(new Date()),
        updatedAt: dateToISO(new Date()),
      };

      await db.loans.add(newLoan);
      setLoans((currentLoans) => [...currentLoans, newLoan]);
      return newLoan;
    },
    [],
  );

  const updateLoan = useCallback(async (id: string, updates: Partial<Loan>): Promise<Loan> => {
    const existingLoan = await db.loans.get(id);
    if (!existingLoan) {
      throw new Error('Loan not found');
    }

    const updatedLoan: Loan = {
      ...existingLoan,
      ...updates,
      updatedAt: dateToISO(new Date()),
    };

    if (
      updates.principal !== undefined ||
      updates.insuranceAmount !== undefined ||
      updates.interestRate !== undefined ||
      updates.tenureMonths !== undefined
    ) {
      updatedLoan.emiAmount = calculateTotalLoanEMI(
        updatedLoan.principal,
        updatedLoan.insuranceAmount,
        updatedLoan.interestRate,
        updatedLoan.tenureMonths,
      );
    }

    await db.loans.update(id, updatedLoan);
    setLoans((currentLoans) => currentLoans.map((loan) => (loan.id === id ? updatedLoan : loan)));
    return updatedLoan;
  }, []);

  const deleteLoan = useCallback(async (id: string): Promise<void> => {
    await deleteLoanData(id);
    setLoans((currentLoans) => currentLoans.filter((loan) => loan.id !== id));
  }, []);

  const getLoan = useCallback(async (id: string): Promise<Loan | undefined> => {
    return db.loans.get(id);
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
