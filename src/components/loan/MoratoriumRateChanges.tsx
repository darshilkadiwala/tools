import { type JSX } from 'react';

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, type Control } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PercentageInput } from '@/components/ui/percentage-input';
import type { LoanFormValues } from '@/lib/schemas/loan-form-schema';

import { FieldLabel } from './FieldLabel';

interface MoratoriumRateChangesProps {
  control: Control<LoanFormValues>;
  startDate?: string;
  emiStartDate?: string;
  startingRate?: number;
}

export function MoratoriumRateChanges({
  control,
  startDate,
  emiStartDate,
  startingRate,
}: MoratoriumRateChangesProps): JSX.Element {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'moratoriumRateChanges',
  });

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <FieldLabel
          help={`Starting rate is ${startingRate ?? 0}% (from loan terms). Add each rate change during the study period — typically on 15 Oct each year for SBI loans.`}>
          Moratorium rate changes
        </FieldLabel>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            append({
              date: startDate ?? '',
              newInterestRate: startingRate ?? 0,
            })
          }>
          <Plus className='size-4' />
          Add rate change
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
          No rate changes during moratorium. Interest will use the starting rate ({startingRate ?? 0}%) for the entire
          study period.
        </p>
      ) : (
        <div className='space-y-3'>
          {fields.map((field, index) => (
            <div
              key={field.id}
              className='bg-muted/30 grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto]'>
              <FormField
                control={control}
                name={`moratoriumRateChanges.${index}.date`}
                render={({ field: dateField }) => (
                  <FormItem>
                    <FieldLabel>Effective date</FieldLabel>
                    <FormControl>
                      <Input type='date' min={startDate ?? ''} max={emiStartDate ?? ''} {...dateField} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`moratoriumRateChanges.${index}.newInterestRate`}
                render={({ field: rateField }) => (
                  <FormItem>
                    <FieldLabel>New rate (% p.a.)</FieldLabel>
                    <FormControl>
                      <PercentageInput
                        placeholder='9.00'
                        value={rateField.value ?? 0}
                        onChange={rateField.onChange}
                        onBlur={rateField.onBlur}
                        name={rateField.name}
                        ref={rateField.ref}
                      />
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
                  aria-label='Remove rate change'>
                  <Trash2 className='text-muted-foreground size-4' />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
