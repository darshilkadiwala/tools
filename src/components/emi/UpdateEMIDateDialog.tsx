import { useState, type JSX } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { InlineError } from '@/components/ui/inline-error';
import { Input } from '@/components/ui/input';
import { useEMISchedule } from '@/contexts/EMIScheduleContext';
import { updateEMIDateRange } from '@/lib/db';
import { dateToISODateString } from '@/lib/utils';

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

export function UpdateEMIDateDialog({
  open,
  onOpenChange,
  loanId,
  maxEMINumber,
  onSuccess,
}: UpdateEMIDateDialogProps): JSX.Element {
  const { refreshSchedule } = useEMISchedule();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<UpdateEMIDateFormValues>({
    resolver: zodResolver(updateEMIDateSchema),
    defaultValues: {
      startEMINumber: 1,
      endEMINumber: maxEMINumber,
      newStartDate: dateToISODateString(new Date()),
    },
  });

  const handleSubmit = async (data: UpdateEMIDateFormValues): Promise<void> => {
    try {
      setLoading(true);
      setSubmitError(null);

      await updateEMIDateRange(loanId, data.startEMINumber, data.endEMINumber, data.newStartDate);
      await refreshSchedule();
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Update EMI date failed:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to update EMI dates');
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
          <form
            onSubmit={(e) => {
              void form.handleSubmit(handleSubmit)(e);
            }}>
            <div className='space-y-4 py-4'>
              {submitError && <InlineError message={submitError} />}
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
