import { useMemo, type JSX } from 'react';

import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/calculations';
import { isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry } from '@/types';

interface MarkAllPendingPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingEntries: EMIScheduleEntry[];
  isProcessing: boolean;
  onConfirm: () => void;
}

export function MarkAllPendingPaidDialog({
  open,
  onOpenChange,
  pendingEntries,
  isProcessing,
  onConfirm,
}: MarkAllPendingPaidDialogProps): JSX.Element {
  const sortedEntries = useMemo(
    () => [...pendingEntries].sort((a, b) => isoToDate(a.dueDate).getTime() - isoToDate(b.dueDate).getTime()),
    [pendingEntries],
  );

  const totalAmount = useMemo(() => sortedEntries.reduce((sum, emi) => sum + emi.total, 0), [sortedEntries]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <CheckCircle2 className='h-5 w-5 text-green-600' />
            Mark all pending EMIs as paid?
          </DialogTitle>
          <DialogDescription>
            {sortedEntries.length} pending {sortedEntries.length === 1 ? 'EMI' : 'EMIs'} totalling{' '}
            {formatCurrency(totalAmount)} will be marked as paid. Upcoming EMIs are not included.
          </DialogDescription>
        </DialogHeader>

        <div className='mt-4 min-h-0 flex-1 overflow-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>EMI #</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className='text-right'>Principal</TableHead>
                <TableHead className='text-right'>Interest</TableHead>
                <TableHead className='text-right'>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((emi) => (
                <TableRow key={emi.id}>
                  <TableCell className='font-medium'>{emi.isAdjustment ? 'Adjustment' : emi.emiNumber}</TableCell>
                  <TableCell>{format(isoToDate(emi.dueDate), 'MMM dd, yyyy')}</TableCell>
                  <TableCell className='text-right'>{formatCurrency(emi.principal)}</TableCell>
                  <TableCell className='text-right'>{formatCurrency(emi.interest)}</TableCell>
                  <TableCell className='text-right font-medium'>{formatCurrency(emi.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className='mt-4'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type='button' onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? 'Updating...' : `Mark ${sortedEntries.length} as Paid`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
