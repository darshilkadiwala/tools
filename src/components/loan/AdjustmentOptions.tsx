import { useMemo, type JSX } from 'react';

import { format } from 'date-fns';
import { useWatch, type Control } from 'react-hook-form';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LocaleNumberInput } from '@/components/ui/locale-number-input';
import { calculateAdjustmentPreview, explainInterestVariance, formatCurrency } from '@/lib/calculations';
import { cn, isoDateStringToDate } from '@/lib/utils';

import type { LoanFormValues } from './loan-form-schema';

interface AdjustmentOptionsProps {
  control: Control<LoanFormValues>;
  className?: string;
}

interface OptionCardProps {
  selected: boolean;
  title: string;
  description: string;
  principal: number;
  interest: number;
  total: number;
  onSelect: () => void;
}

function OptionCard({
  selected,
  title,
  description,
  principal,
  interest,
  total,
  onSelect,
}: OptionCardProps): JSX.Element {
  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border p-4 text-left transition-colors',
        selected ? 'border-primary bg-primary/5 ring-primary ring-1' : 'hover:bg-muted/50',
      )}>
      <div className='mb-2 flex items-start justify-between gap-2'>
        <div>
          <p className='font-medium'>{title}</p>
          <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
        </div>
        <div
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 rounded-full border',
            selected ? 'border-primary bg-primary' : 'border-muted-foreground',
          )}
        />
      </div>
      <div className='text-muted-foreground grid grid-cols-3 gap-2 text-sm'>
        <div>
          <span className='block text-xs'>Principal</span>
          <span className='text-foreground font-medium'>{formatCurrency(principal)}</span>
        </div>
        <div>
          <span className='block text-xs'>Interest</span>
          <span className='text-foreground font-medium'>{formatCurrency(interest)}</span>
        </div>
        <div>
          <span className='block text-xs'>Total</span>
          <span className='text-foreground font-medium'>{formatCurrency(total)}</span>
        </div>
      </div>
    </button>
  );
}

export function AdjustmentOptions({ control, className }: AdjustmentOptionsProps): JSX.Element | null {
  const [
    startDate,
    emiStartDate,
    principal,
    insuranceAmount,
    interestRate,
    tenureMonths,
    adjustmentType,
    customPrincipal,
    customInterest,
    interestRounding,
  ] = useWatch({
    control,
    name: [
      'startDate',
      'emiStartDate',
      'principal',
      'insuranceAmount',
      'interestRate',
      'tenureMonths',
      'adjustmentType',
      'customAdjustmentPrincipal',
      'customAdjustmentInterest',
      'interestRounding',
    ],
  });

  const rounding = interestRounding ?? 'round';

  const preview = useMemo(() => {
    if (!startDate || !emiStartDate || (principal ?? 0) <= 0 || (tenureMonths ?? 0) <= 0) {
      return null;
    }

    return calculateAdjustmentPreview(
      principal ?? 0,
      interestRate ?? 0,
      tenureMonths ?? 0,
      startDate,
      emiStartDate,
      (insuranceAmount ?? 0) > 0 ? insuranceAmount : undefined,
      rounding,
    );
  }, [startDate, emiStartDate, principal, insuranceAmount, interestRate, tenureMonths, rounding]);

  const varianceAnalysis = useMemo(() => {
    if (!preview?.needsAdjustment || adjustmentType !== 'custom') {
      return null;
    }

    const bankInterest = customInterest ?? 0;
    const bankPrincipal = customPrincipal ?? 0;

    if (bankInterest <= 0 && bankPrincipal <= 0) {
      return null;
    }

    const totalPrincipal = (principal ?? 0) + ((insuranceAmount ?? 0) > 0 ? (insuranceAmount ?? 0) : 0);

    return explainInterestVariance(
      totalPrincipal,
      interestRate ?? 0,
      preview.interestOnly.interest,
      bankInterest,
      preview.daysFromStart,
      preview.daysInMonth,
      {
        calculatedPrincipal: preview.proportional.principal,
        bankPrincipal,
      },
    );
  }, [preview, principal, insuranceAmount, interestRate, adjustmentType, customInterest, customPrincipal]);

  if (!preview?.needsAdjustment) {
    return null;
  }

  const customTotal = (customPrincipal ?? 0) + (customInterest ?? 0);
  const splitInterest = preview.splitInterestOnly;
  const interestOnlyDescription = splitInterest
    ? `Bank charges each sub-loan separately (actual/365 × ${preview.daysFromStart} day): Home ${formatCurrency(splitInterest.components[0]?.interest ?? 0)} + Insurance ${formatCurrency(splitInterest.components[1]?.interest ?? 0)}.`
    : 'Bank charged interest for the partial period with no principal repayment.';

  return (
    <Card className={cn('overflow-hidden shadow-sm', className)}>
      <CardHeader className='bg-muted/50 border-b'>
        <CardTitle className='text-base'>Partial period adjustment</CardTitle>
        <CardDescription>
          Disbursement on {format(isoDateStringToDate(startDate), 'MMM d, yyyy')} and first EMI on{' '}
          {format(isoDateStringToDate(emiStartDate), 'MMM d, yyyy')} leave a partial period of{' '}
          <strong>
            {preview.daysFromStart} day{preview.daysFromStart === 1 ? '' : 's'}
          </strong>
          {splitInterest ? (
            <>
              {' '}
              in that month. With home + insurance financed separately, the bank charges interest on each sub-loan using
              actual/365.
            </>
          ) : (
            <> in that month. Choose how the bank handled this period.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <FormField
          control={control}
          name='adjustmentType'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='sr-only'>Adjustment type</FormLabel>
              <div className='space-y-3'>
                <OptionCard
                  selected={field.value === 'proportional'}
                  title='Proportional EMI'
                  description='Split principal and interest proportionally for the partial days (our calculated default).'
                  principal={preview.proportional.principal}
                  interest={preview.proportional.interest}
                  total={preview.proportional.total}
                  onSelect={() => field.onChange('proportional')}
                />
                <OptionCard
                  selected={field.value === 'interest_only'}
                  title={splitInterest ? 'Split Interest (Home + Insurance)' : 'Interest Only'}
                  description={interestOnlyDescription}
                  principal={preview.interestOnly.principal}
                  interest={preview.interestOnly.interest}
                  total={preview.interestOnly.total}
                  onSelect={() => field.onChange('interest_only')}
                />
                <OptionCard
                  selected={field.value === 'none'}
                  title='No Adjustment'
                  description='Skip the partial-period payment entirely and start with the first full EMI.'
                  principal={0}
                  interest={0}
                  total={0}
                  onSelect={() => field.onChange('none')}
                />
                <OptionCard
                  selected={field.value === 'custom'}
                  title='Custom Amount'
                  description='Enter the actual principal and interest the bank charged.'
                  principal={customPrincipal ?? 0}
                  interest={customInterest ?? 0}
                  total={customTotal}
                  onSelect={() => field.onChange('custom')}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {adjustmentType === 'custom' && (
          <div className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={control}
                name='customAdjustmentPrincipal'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Principal (₹)</FormLabel>
                    <FormControl>
                      <LocaleNumberInput
                        className='h-11 text-base'
                        placeholder='0'
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
              <FormField
                control={control}
                name='customAdjustmentInterest'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Interest (₹)</FormLabel>
                    <FormControl>
                      <LocaleNumberInput
                        className='h-11 text-base'
                        placeholder='863'
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
            </div>

            {varianceAnalysis && (
              <div className='bg-muted/50 rounded-lg border p-4 text-sm'>
                <p className='font-medium'>
                  Bank {formatCurrency(varianceAnalysis.bankTotal ?? 0)} (
                  {formatCurrency(varianceAnalysis.bankInterest)} interest
                  {(varianceAnalysis.bankPrincipal ?? 0) > 0 &&
                    ` + ${formatCurrency(varianceAnalysis.bankPrincipal ?? 0)} principal`}
                  ) vs our estimates
                </p>
                <p className='text-muted-foreground mt-1'>
                  Interest gap {formatCurrency(varianceAnalysis.difference)}
                  {(varianceAnalysis.principalDifference ?? 0) !== 0 && (
                    <>, principal gap {formatCurrency(varianceAnalysis.principalDifference ?? 0)}</>
                  )}
                  . Likely explanations:
                </p>
                <ul className='mt-2 space-y-2'>
                  {varianceAnalysis.explanations.map((explanation) => (
                    <li key={explanation.title}>
                      <span className='font-medium'>{explanation.title}:</span> {explanation.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {splitInterest && (
          <div className='bg-muted/50 rounded-lg border p-4 text-sm'>
            <p className='mb-2 font-medium'>Sub-loan broken-period interest</p>
            <ul className='space-y-1'>
              {splitInterest.components.map((component) => (
                <li key={component.label} className='flex justify-between'>
                  <span>{component.label}</span>
                  <span className='font-medium'>{formatCurrency(component.interest)}</span>
                </li>
              ))}
            </ul>
            <p className='mt-2 flex justify-between border-t pt-2 font-medium'>
              <span>Total</span>
              <span>{formatCurrency(splitInterest.total.interest)}</span>
            </p>
          </div>
        )}

        {adjustmentType === 'interest_only' && preview.interestOnly.interest > 0 && !splitInterest && (
          <p className='text-muted-foreground text-sm'>
            If your bank charged a different total, use <strong>Custom Amount</strong> to enter the exact figure.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
