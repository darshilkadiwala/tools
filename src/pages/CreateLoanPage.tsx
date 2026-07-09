import { useState, type JSX } from 'react';

import { useNavigate } from 'react-router-dom';

import { LoanForm } from '@/components/loan/LoanForm';
import { LoanFormPage } from '@/components/loan/LoanFormPage';
import { useLoanContext } from '@/contexts/LoanContext';

import type { Loan } from '@/types';

export function CreateLoanPage(): JSX.Element {
  const { loans } = useLoanContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleCreateLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>): Promise<void> => {
    try {
      setError(null);
      await loans.createLoan(data);
      void navigate('/');
    } catch (error) {
      console.error('Failed to create loan:', error);
      setError(error instanceof Error ? error.message : 'Failed to create loan');
    }
  };

  return (
    <LoanFormPage
      title='Create new loan'
      description='Set up your loan in three steps. We will calculate the EMI schedule once you save.'
      error={error}>
      <LoanForm
        onSubmit={handleCreateLoan}
        onCancel={() => {
          void navigate('/');
        }}
      />
    </LoanFormPage>
  );
}
