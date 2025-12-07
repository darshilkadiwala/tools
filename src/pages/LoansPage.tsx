import { useNavigate } from 'react-router-dom';

import { LoanList } from '@/components/loan/LoanList';
import { Button } from '@/components/ui/button';
import { useLoanContext } from '@/contexts/LoanContext';

export function LoansPage() {
  const { loans } = useLoanContext();
  const navigate = useNavigate();

  if (loans.loading) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center'>
          <div className='border-primary mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground'>Loading loans...</p>
        </div>
      </div>
    );
  }

  if (loans.error) {
    return (
      <div className='space-y-4'>
        <div className='bg-destructive/10 border-destructive/20 text-destructive rounded-lg border p-4'>
          <p className='mb-2 font-medium'>Error loading loans</p>
          <p className='text-sm'>{loans.error.message}</p>
        </div>
        <Button variant='outline' onClick={() => loans.refreshLoans()}>
          Retry
        </Button>
      </div>
    );
  }

  const handleDeleteLoan = async (loanId: string) => {
    if (!confirm('Are you sure you want to delete this loan? This action cannot be undone.')) {
      return;
    }
    try {
      await loans.deleteLoan(loanId);
    } catch (error) {
      console.error('Failed to delete loan:', error);
      alert('Failed to delete loan');
    }
  };

  return (
    <LoanList
      loans={loans.loans}
      onView={(id) => navigate(`/loans/${id}`)}
      onEdit={(id) => navigate(`/loans/${id}/edit`)}
      onDelete={handleDeleteLoan}
      onCreateNew={() => navigate('/loans/create')}
    />
  );
}
