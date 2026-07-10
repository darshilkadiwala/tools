import { useMemo, type JSX } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Car, GraduationCap, Home, MoreHorizontal, Settings2, Tag, Wallet } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocaleNumberInput } from '@/components/ui/locale-number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { needsAdjustmentPayment } from '@/lib/calculations';
import { formatLocaleNumber } from '@/lib/locale';
import { loanFormSchema, type LoanFormValues } from '@/lib/schemas/loan-form-schema';
import { cn, dateToISO, dateToISODateString, isoDateStringToDate, isoToDate } from '@/lib/utils';

import type { Loan, LoanType } from '@/types';

import { AdjustmentOptions } from './AdjustmentOptions';
import { FieldLabel } from './FieldLabel';
import { FormSection } from './FormSection';
import { LoanEMIPreview } from './LoanEMIPreview';
import { MoratoriumOptions } from './MoratoriumOptions';

interface LoanFormProps {
  loan?: Loan;
  onSubmit: (
    data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'> & { fixedEmiAmount?: number },
  ) => Promise<void>;
  onCancel?: () => void;
}

const LOAN_TYPES: Array<{ value: LoanType; label: string; icon: typeof Home }> = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'car', label: 'Car', icon: Car },
  { value: 'education', label: 'Education', icon: GraduationCap },
  { value: 'personal', label: 'Personal', icon: Briefcase },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

export function LoanForm({ loan, onSubmit, onCancel }: LoanFormProps): JSX.Element {
  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: loan
      ? {
          name: loan.name,
          type: loan.type,
          principal: loan.principal,
          insuranceAmount: loan.insuranceAmount ?? 0,
          interestRate: loan.interestRate,
          tenureMonths: loan.tenureMonths,
          startDate: dateToISODateString(isoToDate(loan.startDate)),
          emiStartDate: dateToISODateString(isoToDate(loan.emiStartDate || loan.startDate)),
          adjustmentType: loan.adjustmentType ?? 'proportional',
          interestRounding: loan.interestRounding ?? 'round',
          customAdjustmentPrincipal: loan.customAdjustmentPrincipal ?? 0,
          customAdjustmentInterest: loan.customAdjustmentInterest ?? 0,
          emiCalculationMode: loan.emiCalculationMode ?? 'formula',
          fixedEmiAmount: loan.emiCalculationMode === 'fixed' ? loan.emiAmount : 0,
          disbursedPrincipal: loan.disbursedPrincipal ?? 0,
          disbursements: (loan.disbursements ?? []).map((disb) => ({
            date: dateToISODateString(isoToDate(disb.date)),
            amount: disb.amount,
            label: disb.label ?? '',
          })),
          moratoriumRateChanges: (loan.moratoriumRateChanges ?? []).map((change) => ({
            date: dateToISODateString(isoToDate(change.date)),
            newInterestRate: change.newInterestRate,
          })),
          interestAccrualMethod: loan.interestAccrualMethod,
          emiPostingOrder: loan.emiPostingOrder,
          moratoriumInterestMode: loan.moratoriumInterestMode,
        }
      : {
          name: '',
          type: 'home',
          principal: 0,
          insuranceAmount: 0,
          interestRate: 0,
          tenureMonths: 0,
          startDate: dateToISODateString(new Date()),
          emiStartDate: dateToISODateString(new Date()),
          adjustmentType: 'proportional' as const,
          interestRounding: 'round' as const,
          customAdjustmentPrincipal: 0,
          customAdjustmentInterest: 0,
          emiCalculationMode: 'formula' as const,
          fixedEmiAmount: 0,
          disbursedPrincipal: 0,
          disbursements: [],
          moratoriumRateChanges: [],
        },
  });

  const [
    loanStartDate,
    loanType,
    principal,
    insuranceAmount,
    interestRate,
    tenureMonths,
    emiCalculationMode,
    fixedEmiAmount,
  ] = useWatch({
    control: form.control,
    name: [
      'startDate',
      'type',
      'principal',
      'insuranceAmount',
      'interestRate',
      'tenureMonths',
      'emiCalculationMode',
      'fixedEmiAmount',
    ],
  });

  const principalLabel = useMemo(() => {
    const labels: Record<LoanType, string> = {
      home: 'Home loan amount',
      car: 'Car loan amount',
      education: 'Outstanding at first EMI (₹)',
      personal: 'Personal loan amount',
      other: 'Principal amount',
    };
    return labels[loanType ?? 'home'];
  }, [loanType]);

  const principalHelp = useMemo(() => {
    if (loanType === 'education') {
      return 'Enter the outstanding balance at your first EMI date (after moratorium interest capitalization), not the original disbursed amount.';
    }
    return undefined;
  }, [loanType]);

  const handleSubmit = async (data: LoanFormValues): Promise<void> => {
    const needsAdjustment = needsAdjustmentPayment(data.startDate, data.emiStartDate);
    const hasInsurance = (data.insuranceAmount ?? 0) > 0;

    const trancheTotal = (data.disbursements ?? []).reduce((sum, row) => sum + row.amount, 0);
    const validDisbursements = (data.disbursements ?? []).filter((row) => row.amount > 0 && row.date);
    const validRateChanges = (data.moratoriumRateChanges ?? []).filter((row) => row.date && row.newInterestRate >= 0);

    await onSubmit({
      name: data.name,
      type: data.type as LoanType,
      principal: data.principal,
      ...(hasInsurance ? { insuranceAmount: data.insuranceAmount } : {}),
      interestRate: data.interestRate,
      tenureMonths: data.tenureMonths,
      interestRounding: data.interestRounding ?? 'round',
      emiCalculationMode: data.emiCalculationMode ?? 'formula',
      ...(data.emiCalculationMode === 'fixed' ? { fixedEmiAmount: data.fixedEmiAmount } : {}),
      ...(trancheTotal === 0 && data.disbursedPrincipal && data.disbursedPrincipal > 0
        ? { disbursedPrincipal: data.disbursedPrincipal }
        : {}),
      ...(validDisbursements.length > 0
        ? {
            disbursements: validDisbursements.map((disb) => ({
              date: dateToISO(isoDateStringToDate(disb.date)),
              amount: disb.amount,
              ...(disb.label ? { label: disb.label } : {}),
            })),
          }
        : {}),
      ...(validRateChanges.length > 0
        ? {
            moratoriumRateChanges: validRateChanges.map((change) => ({
              date: dateToISO(isoDateStringToDate(change.date)),
              newInterestRate: change.newInterestRate,
            })),
          }
        : {}),
      ...(data.interestAccrualMethod ? { interestAccrualMethod: data.interestAccrualMethod } : {}),
      ...(data.emiPostingOrder ? { emiPostingOrder: data.emiPostingOrder } : {}),
      ...(data.moratoriumInterestMode ? { moratoriumInterestMode: data.moratoriumInterestMode } : {}),
      startDate: dateToISO(isoDateStringToDate(data.startDate)),
      emiStartDate: dateToISO(isoDateStringToDate(data.emiStartDate)),
      ...(needsAdjustment
        ? {
            adjustmentType: data.adjustmentType ?? (hasInsurance ? 'interest_only' : 'proportional'),
            ...(data.adjustmentType === 'custom'
              ? {
                  customAdjustmentPrincipal: data.customAdjustmentPrincipal,
                  customAdjustmentInterest: data.customAdjustmentInterest,
                }
              : {}),
          }
        : {}),
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(handleSubmit)(e);
        }}
        className='relative'>
        <LoanEMIPreview
          className='lg:hidden'
          principal={principal ?? 0}
          insuranceAmount={insuranceAmount ?? 0}
          interestRate={interestRate ?? 0}
          tenureMonths={tenureMonths ?? 0}
          emiCalculationMode={emiCalculationMode ?? 'formula'}
          fixedEmiAmount={fixedEmiAmount ?? 0}
        />
        <div className='grid grid-cols-[minmax(1fr,auto)] gap-4'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-3'>
            <FormSection
              step={1}
              icon={Tag}
              title='Loan identity'
              description='Give your loan a recognizable name and choose its type.'>
              <div className='space-y-5'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Loan name</FieldLabel>
                      <FormControl>
                        <Input placeholder='e.g., Home Loan' {...field} />
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
                      <FieldLabel>Loan type</FieldLabel>
                      <div className='flex flex-row flex-wrap items-center gap-2'>
                        {LOAN_TYPES.map(({ value, label, icon: Icon }) => {
                          const selected = field.value === value;
                          return (
                            <Button
                              key={value}
                              size='lg'
                              type='button'
                              onClick={() => field.onChange(value)}
                              variant='outline'
                              className={cn(
                                selected && 'border-primary bg-primary/5 text-primary ring-primary ring-1',
                                'w-auto flex-1 shrink grow',
                              )}>
                              <Icon aria-hidden />
                              <span className='font-medium'>{label}</span>
                            </Button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            <FormSection
              step={2}
              icon={Wallet}
              title='Loan terms'
              description='Enter the principal, interest rate, and repayment period from your loan agreement.'>
              <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='principal'
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel help={principalHelp}>{principalLabel}</FieldLabel>
                      <FormControl>
                        <LocaleNumberInput
                          placeholder={
                            loanType === 'home' ? formatLocaleNumber(3_400_000) : formatLocaleNumber(1_000_000)
                          }
                          value={field.value}
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
                  control={form.control}
                  name='insuranceAmount'
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel help='Enter the insurance premium financed by the bank (e.g. ₹1,35,116). We track its EMI and broken-period interest separately.'>
                        Insurance premium (₹)
                      </FieldLabel>
                      <FormControl>
                        <LocaleNumberInput
                          placeholder='1,35,116'
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
                  control={form.control}
                  name='interestRate'
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Annual interest rate (%)</FieldLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          min='0'
                          max='100'
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
                      <FieldLabel help='Total number of monthly installments in your loan agreement. 240 months = 20 years. With a fixed EMI, actual tenure may be shorter if the loan is repaid early.'>
                        Tenure (months)
                      </FieldLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min='1'
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

                <div className='space-y-4 sm:col-span-2'>
                  <FormField
                    control={form.control}
                    name='emiCalculationMode'
                    render={({ field }) => (
                      <FormItem>
                        <div className='bg-muted/30 flex items-start gap-3 rounded-lg border p-4'>
                          <Checkbox
                            id='fixed-emi'
                            checked={field.value === 'fixed'}
                            onCheckedChange={(checked) => {
                              field.onChange(checked === true ? 'fixed' : 'formula');
                            }}
                          />
                          <div className='space-y-1'>
                            <Label htmlFor='fixed-emi' className='text-sm font-medium'>
                              Use bank-stated fixed EMI
                            </Label>
                            <p className='text-muted-foreground text-xs leading-relaxed'>
                              Enable when your bank charges a fixed monthly amount (e.g. ₹9,500) instead of the
                              formula-calculated EMI. Interest is computed on the reducing balance each month; the
                              remainder goes to principal.
                            </p>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {emiCalculationMode === 'fixed' && (
                    <FormField
                      control={form.control}
                      name='fixedEmiAmount'
                      render={({ field }) => (
                        <FormItem>
                          <FieldLabel help='The exact monthly installment amount you pay, as stated by your bank.'>
                            Fixed EMI amount (₹)
                          </FieldLabel>
                          <FormControl>
                            <LocaleNumberInput
                              placeholder='9,500'
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
                </div>

                {/* <div className='bg-muted/30 space-y-4 rounded-lg border p-4 sm:col-span-2'>
                  <div className='flex items-start gap-3'>
                    <Checkbox
                      id='include-insurance'
                      checked={includeInsurance}
                      onCheckedChange={(checked) => handleInsuranceToggle(checked === true)}
                    />
                    <div className='space-y-1'>
                      <Label htmlFor='include-insurance' className='flex items-center gap-2 text-sm font-medium'>
                        <Shield className='size-3.5' />
                        Include bank-financed insurance
                      </Label>
                      <p className='text-muted-foreground text-xs leading-relaxed'>
                        Enable if your bank finances insurance as a separate sub-loan with its own EMI.
                      </p>
                    </div>
                  </div>
                </div> */}
              </div>
            </FormSection>

            <FormSection
              step={3}
              icon={Settings2}
              title='Schedule & dates'
              className='*:data-[slot=card-content]:space-y-4'
              description='Set when the loan was disbursed and when the first EMI is due.'>
              <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='startDate'
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel help='The date the bank disbursed the loan amount to you.'>
                        Loan start date
                      </FieldLabel>
                      <FormControl>
                        <Input type='date' {...field} />
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
                      <FieldLabel help='The due date of your first regular EMI installment.'>
                        First EMI due date
                      </FieldLabel>
                      <FormControl>
                        <Input type='date' min={loanStartDate ?? ''} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* <div className='rounded-xl border'>
                <button
                  type='button'
                  onClick={() => setShowAdvanced((open) => !open)}
                  className='hover:bg-muted/30 flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors'>
                  <div>
                    <p className='text-sm font-medium'>Advanced settings</p>
                    <p className='text-muted-foreground text-xs'>Interest rounding for broken-period calculations</p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'text-muted-foreground size-4 shrink-0 transition-transform',
                      showAdvanced && 'rotate-180',
                    )}
                  />
                </button>
  
                {showAdvanced && <div className='border-t px-5 py-4'></div>}
              </div> */}
              <FormField
                control={form.control}
                name='interestRounding'
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel help='How interest is rounded to whole rupees for broken-period calculations (actual/365). Many banks round up — choose "Round up" if your bank charges slightly more.'>
                      Interest rounding
                    </FieldLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? 'round'}>
                      <FormControl>
                        <SelectTrigger className='w-full sm:max-w-sm'>
                          <SelectValue placeholder='Select rounding' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position='popper'>
                        <SelectItem value='round'>Round to nearest rupee</SelectItem>
                        <SelectItem value='ceil'>Round up (ceil)</SelectItem>
                        <SelectItem value='floor'>Round down (floor)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <AdjustmentOptions control={form.control} className='col-span-full' />
            <MoratoriumOptions control={form.control} className='col-span-full' />
          </div>

          <aside className='hidden lg:block'>
            <div className='sticky top-20'>
              <LoanEMIPreview
                principal={principal ?? 0}
                insuranceAmount={insuranceAmount ?? 0}
                interestRate={interestRate ?? 0}
                tenureMonths={tenureMonths ?? 0}
                emiCalculationMode={emiCalculationMode ?? 'formula'}
                fixedEmiAmount={fixedEmiAmount ?? 0}
              />
            </div>
          </aside>
        </div>

        <div className='bg-background/80 supports-backdrop-filter:bg-background/60 sticky bottom-0 z-10 -mx-4 mt-6 border-t px-4 py-4 backdrop-blur md:-mx-6 md:px-6 lg:col-span-2'>
          <div className='flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <p className='text-muted-foreground hidden text-xs sm:block'>
              {loan ? 'Changes will regenerate the EMI schedule.' : 'You can edit all details after creating the loan.'}
            </p>
            <div className='flex items-center justify-end gap-3'>
              {onCancel && (
                <Button type='button' variant='outline' onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type='submit' disabled={form.formState.isSubmitting} className='min-w-32'>
                {form.formState.isSubmitting ? 'Saving…' : loan ? 'Update loan' : 'Create loan'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
