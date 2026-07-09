import { useState, type JSX } from 'react';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InlineError } from '@/components/ui/inline-error';
import { useLoanContext } from '@/contexts/LoanContext';

import type { Loan } from '@/types';

interface DeleteLoanDialogProps {
  loan: Pick<Loan, 'id' | 'name'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteLoanDialog({ loan, open, onOpenChange, onDeleted }: DeleteLoanDialogProps): JSX.Element {
  const { loans } = useLoanContext();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && !isDeleting) {
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true);
    setError(null);

    try {
      await loans.deleteLoan(loan.id);
      handleOpenChange(false);
      onDeleted?.();
    } catch (deleteError) {
      console.error('Failed to delete loan:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete loan');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='text-destructive size-5' />
            Delete loan?
          </DialogTitle>
          <DialogDescription>
            This permanently removes <span className='text-foreground font-medium'>{loan.name}</span> and all related
            data. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 text-sm'>
          <p className='font-medium'>What will be deleted</p>
          <ul className='text-muted-foreground list-disc space-y-1 pl-5'>
            <li>Loan details and settings</li>
            <li>Full EMI schedule and payment history</li>
            <li>Pre-payments, step-ups, and interest rate changes</li>
          </ul>
        </div>

        {error ? <InlineError message={error} /> : null}

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button type='button' variant='destructive' onClick={() => void handleDelete()} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Loan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
