import { useMemo, type JSX } from 'react';

import { format } from 'date-fns';
import { useWatch, type Control } from 'react-hook-form';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { LocaleNumberInput } from '@/components/ui/locale-number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  formatCurrency,
  getMoratoriumMonthCount,
  hasMoratoriumPeriod,
  resolveEmiPostingOrder,
  resolveInterestAccrualMethod,
} from '@/lib/calculations';
import type { LoanFormValues } from '@/lib/schemas/loan-form-schema';
import { cn, isoDateStringToDate } from '@/lib/utils';

import { DisbursementTranches } from './DisbursementTranches';
import { FieldLabel } from './FieldLabel';
import { MoratoriumRateChanges } from './MoratoriumRateChanges';

interface MoratoriumOptionsProps {
  control: Control<LoanFormValues>;
  className?: string;
}

function formatYearsMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} months`;
  if (rem === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years} yr ${rem} mo`;
}

export function MoratoriumOptions({ control, className }: MoratoriumOptionsProps): JSX.Element | null {
  const [
    startDate,
    emiStartDate,
    principal,
    disbursedPrincipal,
    disbursements,
    loanType,
    interestRate,
    interestAccrualMethod,
    emiPostingOrder,
  ] = useWatch({
    control,
    name: [
      'startDate',
      'emiStartDate',
      'principal',
      'disbursedPrincipal',
      'disbursements',
      'type',
      'interestRate',
      'interestAccrualMethod',
      'emiPostingOrder',
    ],
  });

  const showMoratorium = useMemo(() => {
    if (!startDate || !emiStartDate) return false;
    return hasMoratoriumPeriod(startDate, emiStartDate);
  }, [startDate, emiStartDate]);

  const monthCount = useMemo(() => {
    if (!startDate || !emiStartDate) return 0;
    return getMoratoriumMonthCount(startDate, emiStartDate);
  }, [startDate, emiStartDate]);

  const trancheTotal = useMemo(
    () => (disbursements ?? []).reduce((sum, row) => sum + (row?.amount ?? 0), 0),
    [disbursements],
  );

  const effectiveDisbursed = trancheTotal > 0 ? trancheTotal : (disbursedPrincipal ?? 0);

  const capitalizedInterest = useMemo(() => {
    if (!effectiveDisbursed || !principal || effectiveDisbursed <= 0) return null;
    return principal - effectiveDisbursed;
  }, [effectiveDisbursed, principal]);

  const resolvedAccrual = resolveInterestAccrualMethod({
    type: loanType ?? 'home',
    interestAccrualMethod,
    startDate: startDate ?? '',
    emiStartDate,
  });

  const resolvedPosting = resolveEmiPostingOrder({
    type: loanType ?? 'home',
    emiPostingOrder,
    startDate: startDate ?? '',
    emiStartDate,
  });

  if (!showMoratorium) {
    return null;
  }

  return (
    <Card className={cn('overflow-hidden shadow-sm', className)}>
      <CardHeader className='bg-muted/50 border-b'>
        <CardTitle className='text-base'>Study / moratorium period</CardTitle>
        <CardDescription>
          Disbursement on {format(isoDateStringToDate(startDate), 'MMM d, yyyy')} and first EMI on{' '}
          {format(isoDateStringToDate(emiStartDate), 'MMM d, yyyy')} span{' '}
          <strong>{formatYearsMonths(monthCount)}</strong> of interest-only accrual before regular EMIs begin. During
          this period the bank charges interest monthly and capitalizes it into the outstanding balance.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6 pt-5'>
        <DisbursementTranches control={control} startDate={startDate} emiStartDate={emiStartDate} />

        {(disbursements?.length ?? 0) === 0 && (
          <FormField
            control={control}
            name='disbursedPrincipal'
            render={({ field }) => (
              <FormItem>
                <FieldLabel help='Total amount disbursed if you prefer a single figure instead of individual tranches.'>
                  Total disbursed amount (₹)
                </FieldLabel>
                <FormControl>
                  <LocaleNumberInput
                    placeholder='4,18,000'
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {capitalizedInterest !== null && capitalizedInterest > 0 && (
          <div className='bg-muted/50 rounded-lg border p-4 text-sm'>
            <p>
              Capitalized interest: <strong>{formatCurrency(capitalizedInterest)}</strong> (
              {formatCurrency(effectiveDisbursed)} disbursed → {formatCurrency(principal ?? 0)} at repayment start)
            </p>
          </div>
        )}

        <MoratoriumRateChanges
          control={control}
          startDate={startDate}
          emiStartDate={emiStartDate}
          startingRate={interestRate}
        />

        <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
          <FormField
            control={control}
            name='interestAccrualMethod'
            render={({ field }) => (
              <FormItem>
                <FieldLabel help='SBI education loans typically use actual/365 day-count for monthly interest.'>
                  Interest calculation
                </FieldLabel>
                <Select onValueChange={field.onChange} value={field.value ?? resolvedAccrual}>
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select method' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent position='popper'>
                    <SelectItem value='actual_365'>Actual/365 (bank-style)</SelectItem>
                    <SelectItem value='monthly_reducing'>Monthly reducing balance</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name='emiPostingOrder'
            render={({ field }) => (
              <FormItem>
                <FieldLabel help='SBI credits the full EMI first, then charges month-end interest — net principal = EMI − interest.'>
                  EMI posting order
                </FieldLabel>
                <Select onValueChange={field.onChange} value={field.value ?? resolvedPosting}>
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select order' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent position='popper'>
                    <SelectItem value='emi_first'>EMI first, then interest (SBI-style)</SelectItem>
                    <SelectItem value='standard'>Standard (interest then split EMI)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className='text-muted-foreground text-xs leading-relaxed'>
          <strong>Principal amount</strong> above should be the outstanding balance at the first EMI date (
          {formatCurrency(principal ?? 0)}), not the original disbursed amount. Moratorium rows appear in the schedule
          when tranches or a disbursed total is entered.
        </p>
      </CardContent>
    </Card>
  );
}
