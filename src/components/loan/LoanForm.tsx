import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dateToISO, dateToISODateString, isoDateStringToDate, isoToDate } from '@/lib/utils';

import type { Loan, LoanType } from '@/types';

const loanFormSchema = z.object({
  name: z.string().min(1, 'Loan name is required'),
  type: z.enum(['home', 'car', 'education', 'personal', 'other']),
  principal: z.number().min(1, 'Principal must be greater than 0'),
  interestRate: z.number().min(0, 'Interest rate must be non-negative').max(100, 'Interest rate cannot exceed 100%'),
  tenureMonths: z.number().min(1, 'Tenure must be at least 1 month'),
  startDate: z.string().min(1, 'Loan start date is required'),
  emiStartDate: z.string().min(1, 'EMI start date is required'),
});

type LoanFormValues = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  loan?: Loan;
  onSubmit: (data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>) => Promise<void>;
  onCancel?: () => void;
}

export function LoanForm({ loan, onSubmit, onCancel }: LoanFormProps) {
  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: loan
      ? {
          name: loan.name,
          type: loan.type,
          principal: loan.principal,
          interestRate: loan.interestRate,
          tenureMonths: loan.tenureMonths,
          startDate: dateToISODateString(isoToDate(loan.startDate)),
          emiStartDate: dateToISODateString(isoToDate(loan.emiStartDate || loan.startDate)),
        }
      : {
          name: '',
          type: 'home',
          principal: 0,
          interestRate: 0,
          tenureMonths: 0,
          startDate: dateToISODateString(new Date()),
          emiStartDate: dateToISODateString(new Date()),
        },
  });

  const handleSubmit = async (data: LoanFormValues) => {
    await onSubmit({
      name: data.name,
      type: data.type as LoanType,
      principal: data.principal,
      interestRate: data.interestRate,
      tenureMonths: data.tenureMonths,
      startDate: dateToISO(isoDateStringToDate(data.startDate)),
      emiStartDate: dateToISO(isoDateStringToDate(data.emiStartDate)),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='relative space-y-6'>
        {/* Basic Information Section */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-foreground mb-3 text-lg font-semibold'>Basic Information</h3>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-base font-medium'>Loan Name</FormLabel>
                    <FormControl>
                      <Input className='h-11 text-base' placeholder='e.g., Home Loan - HDFC' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-base font-medium'>Loan Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className='h-11! w-full py-1 text-base'>
                          <SelectValue placeholder='Select loan type' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='home'>Home Loan</SelectItem>
                        <SelectItem value='car'>Car Loan</SelectItem>
                        <SelectItem value='education'>Education Loan</SelectItem>
                        <SelectItem value='personal'>Personal Loan</SelectItem>
                        <SelectItem value='other'>Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Financial Details Section */}
          <div className='border-t pt-4'>
            <h3 className='text-foreground mb-3 text-lg font-semibold'>Financial Details</h3>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='principal'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-base font-medium'>Principal Amount (₹)</FormLabel>
                    <FormControl>
                      <Input
                        className='h-11 text-base'
                        type='number'
                        step='0.01'
                        placeholder='1000000'
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='interestRate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-base font-medium'>Annual Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        className='h-11 text-base'
                        type='number'
                        step='0.01'
                        placeholder='8.5'
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tenureMonths'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-base font-medium'>Tenure (Months)</FormLabel>
                    <FormControl>
                      <Input
                        className='h-11 text-base'
                        type='number'
                        placeholder='240'
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Date Information Section */}
          <div className='border-t pt-4'>
            <h3 className='text-foreground mb-3 text-lg font-semibold'>Date Information</h3>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='startDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-base font-medium'>Loan Start Date</FormLabel>
                    <FormControl>
                      <Input className='h-11 text-base' type='date' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='emiStartDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-base font-medium'>First EMI Due Date</FormLabel>
                    <FormControl>
                      <Input className='h-11 text-base' type='date' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Form actions buttons */}
        <div className='bg-background sticky bottom-0 flex items-center justify-end gap-3 border-t pt-4'>
          {onCancel && (
            <Button type='button' variant='outline' onClick={onCancel} className='h-11 px-6'>
              Cancel
            </Button>
          )}
          <Button type='submit' disabled={form.formState.isSubmitting} className='h-11 px-6'>
            {form.formState.isSubmitting ? 'Saving...' : loan ? 'Update Loan' : 'Create Loan'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
