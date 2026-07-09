import { useEffect, useState, type JSX } from 'react';

import { Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { DeleteLoanDialog } from '@/components/loan/DeleteLoanDialog';
import { LoanForm } from '@/components/loan/LoanForm';
import { LoanFormPage } from '@/components/loan/LoanFormPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/page-loader';
import { useLoanContext } from '@/contexts/LoanContext';

import type { Loan } from '@/types';

export function EditLoanPage(): JSX.Element | null {
  const { id } = useParams<{ id: string }>();
  const { loans } = useLoanContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const loan = loans.loans.find((l) => l.id === id);

  useEffect(() => {
    if (!loans.loading && !loan) {
      void navigate('/');
    }
  }, [loans.loading, loan, navigate]);

  if (loans.loading) {
    return <PageLoader message='Loading loan…' />;
  }

  if (!loan) return null;

  const handleUpdateLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>): Promise<void> => {
    try {
      setError(null);
      await loans.updateLoan(loan.id, data);
      void navigate(`/loans/${loan.id}`);
    } catch (error) {
      console.error('Failed to update loan:', error);
      setError(error instanceof Error ? error.message : 'Failed to update loan');
    }
  };

  return (
    <LoanFormPage
      title={`Edit ${loan.name}`}
      description='Update loan details. The EMI schedule will be regenerated to reflect your changes.'
      backHref={`/loans/${loan.id}`}
      backLabel='Back to Loan Details'
      error={error}>
      <div className='space-y-8'>
        <LoanForm
          loan={loan}
          onSubmit={handleUpdateLoan}
          onCancel={() => {
            void navigate(`/loans/${loan.id}`);
          }}
        />

        <Card className='border-destructive/30'>
          <CardHeader>
            <CardTitle className='text-destructive text-base'>Danger zone</CardTitle>
            <CardDescription>
              Permanently delete this loan and all EMI schedule data. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type='button' variant='destructive-outline' onClick={() => setShowDelete(true)}>
              <Trash2 className='size-4' />
              Delete loan
            </Button>
          </CardContent>
        </Card>
      </div>

      <DeleteLoanDialog
        loan={loan}
        open={showDelete}
        onOpenChange={setShowDelete}
        onDeleted={() => {
          void navigate('/');
        }}
      />
    </LoanFormPage>
  );
}
