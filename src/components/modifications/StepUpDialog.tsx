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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEMISchedule } from '@/contexts/EMIScheduleContext';
import { useLoanOperations } from '@/hooks/useLoanOperations';

const stepUpSchema = z
  .object({
    stepUpType: z.enum(['amount', 'percentage']),
    amount: z.number().optional(),
    percentage: z.number().optional(),
    fromEMINumber: z.number().min(1, 'EMI number must be at least 1'),
  })
  .refine(
    (data) => {
      if (data.stepUpType === 'amount') {
        return data.amount !== undefined && data.amount > 0;
      }
      return data.percentage !== undefined && data.percentage > 0;
    },
    {
      message: 'Either amount or percentage must be provided',
    },
  );

type StepUpFormValues = z.infer<typeof stepUpSchema>;

interface StepUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  maxEMINumber: number;
  onSuccess?: () => void;
}

export function StepUpDialog({ open, onOpenChange, loanId, maxEMINumber, onSuccess }: StepUpDialogProps): JSX.Element {
  const { applyStepUp } = useLoanOperations();
  const { refreshSchedule } = useEMISchedule();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<StepUpFormValues>({
    resolver: zodResolver(stepUpSchema),
    defaultValues: {
      stepUpType: 'amount',
      amount: 0,
      percentage: 0,
      fromEMINumber: 1,
    },
  });

  const stepUpType = form.watch('stepUpType');

  const handleSubmit = async (data: StepUpFormValues): Promise<void> => {
    try {
      setLoading(true);
      setSubmitError(null);
      await applyStepUp(
        loanId,
        data.stepUpType === 'amount' ? data.amount || null : null,
        data.stepUpType === 'percentage' ? data.percentage || null : null,
        data.fromEMINumber,
      );
      await refreshSchedule();
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Step-up failed:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to apply step-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Step-up EMI</DialogTitle>
          <DialogDescription>
            Increase your EMI amount by a fixed amount or percentage. This will be applied to all remaining EMIs from
            the selected EMI number.
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
                name='stepUpType'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Step-up Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select type' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position='popper'>
                        <SelectItem value='amount'>Fixed Amount</SelectItem>
                        <SelectItem value='percentage'>Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.stepUpType?.message}</FormMessage>
                  </FormItem>
                )}
              />

              {stepUpType === 'amount' ? (
                <FormField
                  control={form.control}
                  name='amount'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Step-up Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          placeholder='5000'
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.amount?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name='percentage'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Step-up Percentage (%)</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          placeholder='10'
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.percentage?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name='fromEMINumber'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apply from EMI Number</FormLabel>
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
                    <FormMessage>{form.formState.errors.fromEMINumber?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={loading}>
                {loading ? 'Processing...' : 'Apply Step-up'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
