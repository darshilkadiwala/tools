import { useState, type JSX } from 'react';

import { useNavigate } from 'react-router-dom';

import { DeleteLoanDialog } from '@/components/loan/DeleteLoanDialog';
import { LoanList } from '@/components/loan/LoanList';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';
import { useLoanContext } from '@/contexts/LoanContext';

import type { Loan } from '@/types';

export function LoansPage(): JSX.Element {
  const { loans } = useLoanContext();
  const navigate = useNavigate();
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);

  if (loans.loading) {
    return <PageLoader message='Loading loans...' />;
  }

  if (loans.error) {
    return (
      <div className='space-y-4'>
        <div className='bg-destructive/10 border-destructive/20 text-destructive rounded-lg border p-4'>
          <p className='mb-2 font-medium'>Error loading loans</p>
          <p className='text-sm'>{loans.error.message}</p>
        </div>
        <Button
          variant='outline'
          onClick={() => {
            void loans.refreshLoans();
          }}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <LoanList
        loans={loans.loans}
        onView={(id) => {
          void navigate(`/loans/${id}`);
        }}
        onEdit={(id) => {
          void navigate(`/loans/${id}/edit`);
        }}
        onDelete={(id) => {
          setLoanToDelete(loans.loans.find((loan) => loan.id === id) ?? null);
        }}
        onCreateNew={() => {
          void navigate('/loans/create');
        }}
      />

      {loanToDelete ? (
        <DeleteLoanDialog
          loan={loanToDelete}
          open={loanToDelete !== null}
          onOpenChange={(open) => {
            if (!open) {
              setLoanToDelete(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
