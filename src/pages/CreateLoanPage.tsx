import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { LoanForm } from '@/components/loan/LoanForm';
import { Separator } from '@/components/ui/separator';
import { useLoanContext } from '@/contexts/LoanContext';

import type { Loan } from '@/types';

export function CreateLoanPage() {
  const { loans } = useLoanContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleCreateLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>) => {
    try {
      setError(null);
      await loans.createLoan(data);
      navigate('/');
    } catch (error) {
      console.error('Failed to create loan:', error);
      setError(error instanceof Error ? error.message : 'Failed to create loan');
    }
  };

  return (
    <>
      {error && (
        <div className='bg-destructive/10 border-destructive/20 text-destructive mb-6 rounded-lg border p-4 text-sm'>
          {error}
        </div>
      )}

      <h1 className='mb-2 text-3xl font-bold tracking-tight'>Create New Loan</h1>
      <p className='text-muted-foreground text-base'>Fill in the details below to create a new loan account</p>
      <Separator className='my-4' />

      <LoanForm onSubmit={handleCreateLoan} onCancel={() => navigate('/')} />
    </>
  );
}
