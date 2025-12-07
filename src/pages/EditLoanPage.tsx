import { useEffect, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import { LoanForm } from '@/components/loan/LoanForm';
import { useLoanContext } from '@/contexts/LoanContext';

import type { Loan } from '@/types';

export function EditLoanPage() {
  const { id } = useParams<{ id: string }>();
  const { loans } = useLoanContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const loan = loans.loans.find((l) => l.id === id);

  useEffect(() => {
    if (!loans.loading && !loan) {
      navigate('/');
    }
  }, [loans.loading, loan, navigate]);

  if (loans.loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-center'>
          <div className='border-primary mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      </div>
    );
  }

  if (!loan) return null;

  const handleUpdateLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>) => {
    try {
      setError(null);
      await loans.updateLoan(loan.id, data);
      navigate('/');
    } catch (error) {
      console.error('Failed to update loan:', error);
      setError(error instanceof Error ? error.message : 'Failed to update loan');
    }
  };

  return (
    <div className='space-y-8'>
      {error && (
        <div className='bg-destructive/10 border-destructive/20 text-destructive rounded-lg border p-4 text-sm'>
          {error}
        </div>
      )}

      <div className='space-y-2'>
        <h1 className='text-3xl font-bold tracking-tight'>Edit Loan</h1>
        <p className='text-muted-foreground text-base'>Update the loan details below</p>
      </div>

      <LoanForm loan={loan} onSubmit={handleUpdateLoan} onCancel={() => navigate('/')} />
    </div>
  );
}
