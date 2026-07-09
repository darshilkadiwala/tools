import type { JSX } from 'react';

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

interface RegenerateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paidCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function RegenerateScheduleDialog({
  open,
  onOpenChange,
  paidCount,
  isProcessing,
  onConfirm,
}: RegenerateScheduleDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5 text-amber-500' />
            Regenerate EMI schedule?
          </DialogTitle>
          <DialogDescription>
            This rebuilds the entire schedule from your current loan settings. Some manual changes will be lost.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 text-sm'>
          <div>
            <p className='mb-2 font-medium'>What will be reset</p>
            <ul className='text-muted-foreground list-disc space-y-1 pl-5'>
              <li>
                <span className='text-foreground font-medium'>Paid status</span> — all EMIs return to pending or
                upcoming based on their due dates
                {paidCount > 0 && (
                  <span className='text-foreground'> ({paidCount} currently marked as paid will be reset)</span>
                )}
              </li>
              <li>
                <span className='text-foreground font-medium'>Custom due dates</span> — manual date changes from
                &quot;Update EMI Dates&quot; are discarded
              </li>
              <li>
                <span className='text-foreground font-medium'>Schedule rows</span> — principal, interest, total, and
                outstanding amounts are recalculated from scratch
              </li>
            </ul>
          </div>

          <div>
            <p className='mb-2 font-medium'>What is kept</p>
            <ul className='text-muted-foreground list-disc space-y-1 pl-5'>
              <li>Loan details (principal, rate, tenure, dates, insurance, adjustment settings)</li>
              <li>Pre-payments, step-up EMIs, and interest rate changes</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type='button' variant='destructive' onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? 'Regenerating...' : 'Regenerate Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
