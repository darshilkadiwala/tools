import { useState, type JSX } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

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
import { interestRateSchema, type InterestRateFormValues } from '@/lib/schemas/interest-rate-schema';

interface InterestRateModifierProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  currentRate: number;
  selectedEMIs?: number[];
  onSuccess?: () => void;
}

export function InterestRateModifier({
  open,
  onOpenChange,
  loanId,
  currentRate,
  selectedEMIs = [],
  onSuccess,
}: InterestRateModifierProps): JSX.Element {
  const { changeInterestRate } = useLoanOperations();
  const { refreshSchedule } = useEMISchedule();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<InterestRateFormValues>({
    resolver: zodResolver(interestRateSchema),
    defaultValues: {
      newInterestRate: currentRate,
      applyTo: selectedEMIs.length > 0 ? 'selected' : 'all',
      selectedEMIs: selectedEMIs.length > 0 ? selectedEMIs : undefined,
    },
  });

  const applyTo = form.watch('applyTo');

  const handleSubmit = async (data: InterestRateFormValues): Promise<void> => {
    try {
      setLoading(true);
      setSubmitError(null);
      const affectedEMIs = data.applyTo === 'all' ? 'all' : data.selectedEMIs || [];

      await changeInterestRate(loanId, data.newInterestRate, affectedEMIs);
      await refreshSchedule();
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Interest rate change failed:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to change interest rate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Interest Rate</DialogTitle>
          <DialogDescription>
            Update the interest rate for future EMIs. You can apply it to all remaining EMIs or only selected ones.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              void form.handleSubmit(handleSubmit)(e);
            }}>
            <div className='space-y-4 py-4'>
              {submitError && <InlineError message={submitError} />}
              <div className='text-muted-foreground text-sm'>Current Interest Rate: {currentRate}% p.a.</div>

              <FormField
                control={form.control}
                name='newInterestRate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Interest Rate (% p.a.)</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        placeholder='8.5'
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.newInterestRate?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='applyTo'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apply To</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select scope' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position='popper'>
                        <SelectItem value='all'>All Remaining EMIs</SelectItem>
                        <SelectItem value='selected' disabled={selectedEMIs.length === 0}>
                          Selected EMIs ({selectedEMIs.length})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.applyTo?.message}</FormMessage>
                  </FormItem>
                )}
              />

              {applyTo === 'selected' && selectedEMIs.length > 0 && (
                <div className='text-muted-foreground text-sm'>
                  Selected EMIs: {selectedEMIs.sort((a, b) => a - b).join(', ')}
                </div>
              )}

              {applyTo === 'selected' && selectedEMIs.length === 0 && (
                <div className='text-destructive text-sm'>Please select EMIs from the schedule table first.</div>
              )}
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={loading || (applyTo === 'selected' && selectedEMIs.length === 0)}>
                {loading ? 'Processing...' : 'Update Interest Rate'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
