import { useMemo, type JSX } from 'react';

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useWatch, type Control } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LocaleNumberInput } from '@/components/ui/locale-number-input';
import { formatCurrency } from '@/lib/calculations';
import type { LoanFormValues } from '@/lib/schemas/loan-form-schema';

import { FieldLabel } from './FieldLabel';

interface DisbursementTranchesProps {
  control: Control<LoanFormValues>;
  startDate?: string;
  emiStartDate?: string;
}

export function DisbursementTranches({ control, startDate, emiStartDate }: DisbursementTranchesProps): JSX.Element {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'disbursements',
  });

  const disbursements = useWatch({ control, name: 'disbursements' });

  const totalDisbursed = useMemo(
    () => (disbursements ?? []).reduce((sum, row) => sum + (row?.amount ?? 0), 0),
    [disbursements],
  );

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <FieldLabel help='Enter each tranche as it appears on your bank statement. Dates must fall between loan start and first EMI.'>
          Tranche disbursements
        </FieldLabel>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            append({
              date: startDate ?? '',
              amount: 0,
              label: '',
            })
          }>
          <Plus className='size-4' />
          Add tranche
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
          No tranches added. Click &quot;Add tranche&quot; to enter each disbursement from your bank statement, or enter
          a single disbursed total above.
        </p>
      ) : (
        <div className='space-y-3'>
          {fields.map((field, index) => (
            <div
              key={field.id}
              className='bg-muted/30 grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_1.5fr_auto]'>
              <FormField
                control={control}
                name={`disbursements.${index}.date`}
                render={({ field: dateField }) => (
                  <FormItem>
                    <FieldLabel>Date</FieldLabel>
                    <FormControl>
                      <Input type='date' min={startDate ?? ''} max={emiStartDate ?? ''} {...dateField} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`disbursements.${index}.amount`}
                render={({ field: amountField }) => (
                  <FormItem>
                    <FieldLabel>Amount (₹)</FieldLabel>
                    <FormControl>
                      <LocaleNumberInput
                        placeholder='98,700'
                        value={amountField.value ?? 0}
                        onChange={amountField.onChange}
                        onBlur={amountField.onBlur}
                        name={amountField.name}
                        ref={amountField.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`disbursements.${index}.label`}
                render={({ field: labelField }) => (
                  <FormItem>
                    <FieldLabel>Label (optional)</FieldLabel>
                    <FormControl>
                      <Input placeholder='e.g. University fee' {...labelField} value={labelField.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className='flex items-end'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={() => remove(index)}
                  aria-label='Remove tranche'>
                  <Trash2 className='text-muted-foreground size-4' />
                </Button>
              </div>
            </div>
          ))}
          <p className='text-muted-foreground text-sm'>
            Total disbursed: <strong>{formatCurrency(totalDisbursed)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
