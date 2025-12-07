import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { addMonths, parse } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useEMISchedule } from '@/hooks/useEMISchedule';
import { db } from '@/lib/db';
import { dateToISO, dateToISODateString } from '@/lib/utils';

const updateEMIDateSchema = z
  .object({
    startEMINumber: z.number().min(1, 'Start EMI number must be at least 1'),
    endEMINumber: z.number().min(1, 'End EMI number must be at least 1'),
    newStartDate: z.string().min(1, 'New start date is required'),
  })
  .refine((data) => data.endEMINumber >= data.startEMINumber, {
    message: 'End EMI number must be greater than or equal to start EMI number',
    path: ['endEMINumber'],
  });

type UpdateEMIDateFormValues = z.infer<typeof updateEMIDateSchema>;

interface UpdateEMIDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  maxEMINumber: number;
  onSuccess?: () => void;
}

export function UpdateEMIDateDialog({ open, onOpenChange, loanId, maxEMINumber, onSuccess }: UpdateEMIDateDialogProps) {
  const { refreshSchedule } = useEMISchedule(loanId);
  const [loading, setLoading] = useState(false);

  const form = useForm<UpdateEMIDateFormValues>({
    resolver: zodResolver(updateEMIDateSchema),
    defaultValues: {
      startEMINumber: 1,
      endEMINumber: maxEMINumber,
      newStartDate: dateToISODateString(new Date()),
    },
  });

  const handleSubmit = async (data: UpdateEMIDateFormValues) => {
    try {
      setLoading(true);

      // Get all EMIs for this loan
      const allEMIs = await db.emiSchedules.where('loanId').equals(loanId).sortBy('emiNumber');

      // Get the EMI that will have the new start date
      const startEMI = allEMIs.find((emi) => emi.emiNumber === data.startEMINumber);
      if (!startEMI) {
        throw new Error(`EMI number ${data.startEMINumber} not found`);
      }

      // Calculate the new start date
      const newStartDate = parse(data.newStartDate, 'yyyy-MM-dd', new Date());

      // Calculate the difference in months from the original start EMI date
      const originalStartEMI = allEMIs.find((emi) => emi.emiNumber === data.startEMINumber);
      if (!originalStartEMI) {
        throw new Error('Could not find start EMI');
      }

      // Update all EMIs in the range
      const updates: Array<{ id: string; dueDate: string }> = [];

      for (let i = data.startEMINumber; i <= data.endEMINumber && i <= maxEMINumber; i++) {
        const emi = allEMIs.find((e) => e.emiNumber === i);
        if (emi) {
          // Calculate the offset from the start EMI
          const offset = i - data.startEMINumber;
          const newDueDate = addMonths(newStartDate, offset);
          updates.push({
            id: emi.id,
            dueDate: dateToISO(newDueDate),
          });
        }
      }

      // Update all EMIs in bulk
      for (const update of updates) {
        await db.emiSchedules.update(update.id, { dueDate: update.dueDate });
      }

      await refreshSchedule();
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Update EMI date failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to update EMI dates');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update EMI Date Range</DialogTitle>
          <DialogDescription>
            Update the due dates for a range of EMIs. The first EMI in the range will be set to the new start date, and
            subsequent EMIs will be calculated monthly from that date.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className='space-y-4 py-4'>
              <FormField
                control={form.control}
                name='startEMINumber'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start EMI Number</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={maxEMINumber}
                        placeholder='1'
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.startEMINumber?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='endEMINumber'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End EMI Number</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={maxEMINumber}
                        placeholder={maxEMINumber.toString()}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.endEMINumber?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='newStartDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Start Date (for first EMI in range)</FormLabel>
                    <FormControl>
                      <Input type='date' {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.newStartDate?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={loading}>
                {loading ? 'Updating...' : 'Update EMI Dates'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
