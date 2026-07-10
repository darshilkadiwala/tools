import { useMemo, type JSX } from 'react';

import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';

import { EmiNumberCell } from '@/components/emi/EmiNumberCell';
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
import { formatEntryInterestRate, type ScheduleRateContext } from '@/lib/schedule-rate';
import { isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry } from '@/types';

interface MarkAllPendingPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingEntries: EMIScheduleEntry[];
  rateContext?: ScheduleRateContext;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function MarkAllPendingPaidDialog({
  open,
  onOpenChange,
  pendingEntries,
  rateContext,
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

        <div className='mt-4 min-h-0 flex-1 overflow-auto rounded-md border **:data-[slot=table-container]:overflow-visible'>
          <Table>
            <TableHeader className='bg-background sticky top-0 z-10'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='bg-background'>EMI #</TableHead>
                <TableHead className='bg-background'>Due Date</TableHead>
                <TableHead className='bg-background text-right'>Principal</TableHead>
                <TableHead className='bg-background text-right'>Interest</TableHead>
                <TableHead className='bg-background text-right'>Total</TableHead>
                <TableHead className='bg-background text-right'>Interest Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((emi) => (
                <TableRow key={emi.id}>
                  <TableCell className='font-medium'>
                    <EmiNumberCell emi={emi} />
                  </TableCell>
                  <TableCell>{format(isoToDate(emi.dueDate), 'MMM dd, yyyy')}</TableCell>
                  <TableCell className='text-right'>{formatCurrency(emi.principal)}</TableCell>
                  <TableCell className='text-right'>{formatCurrency(emi.interest)}</TableCell>
                  <TableCell className='text-right font-medium'>{formatCurrency(emi.total)}</TableCell>
                  <TableCell className='text-right'>{formatEntryInterestRate(emi, rateContext)}</TableCell>
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
