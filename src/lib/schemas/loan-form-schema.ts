import { z } from 'zod';

import {
  calculateMinimumFixedEMI,
  calculateTotalLoanEMI,
  hasMoratoriumPeriod,
  needsAdjustmentPayment,
} from '@/lib/calculations';
import { isoDateStringToDate } from '@/lib/utils';

export const loanFormSchema = z
  .object({
    name: z.string().min(1, 'Loan name is required'),
    type: z.enum(['home', 'car', 'education', 'personal', 'other']),
    principal: z.number().min(1, 'Principal must be greater than 0'),
    insuranceAmount: z.number().min(0).optional(),
    interestRate: z.number().min(0, 'Interest rate must be non-negative').max(100, 'Interest rate cannot exceed 100%'),
    tenureMonths: z.number().min(1, 'Tenure must be at least 1 month'),
    startDate: z.string().min(1, 'Loan start date is required'),
    emiStartDate: z.string().min(1, 'EMI start date is required'),
    adjustmentType: z.enum(['proportional', 'interest_only', 'none', 'custom']).optional(),
    interestRounding: z.enum(['round', 'floor', 'ceil']).optional(),
    customAdjustmentPrincipal: z.number().min(0).optional(),
    customAdjustmentInterest: z.number().min(0).optional(),
    emiCalculationMode: z.enum(['formula', 'fixed']).optional(),
    fixedEmiAmount: z.number().min(0).optional(),
    disbursedPrincipal: z.number().min(0).optional(),
    interestAccrualMethod: z.enum(['monthly_reducing', 'actual_365']).optional(),
    emiPostingOrder: z.enum(['standard', 'emi_first']).optional(),
    moratoriumInterestMode: z.enum(['simple_on_disbursements', 'compound_on_outstanding']).optional(),
    disbursements: z
      .array(
        z.object({
          date: z.string().min(1, 'Tranche date is required'),
          amount: z.number().min(1, 'Tranche amount must be greater than 0'),
          label: z.string().optional(),
        }),
      )
      .optional(),
    moratoriumRateChanges: z
      .array(
        z.object({
          date: z.string().min(1, 'Rate change date is required'),
          newInterestRate: z.number().min(0, 'Rate must be non-negative').max(100, 'Rate cannot exceed 100%'),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const loanStart = isoDateStringToDate(data.startDate);
    const emiStart = isoDateStringToDate(data.emiStartDate);

    if (emiStart < loanStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'First EMI due date must be on or after the loan start date',
        path: ['emiStartDate'],
      });
      return;
    }

    if (!needsAdjustmentPayment(data.startDate, data.emiStartDate)) {
      return;
    }

    if (!data.adjustmentType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select how to handle the partial period before the first EMI',
        path: ['adjustmentType'],
      });
      return;
    }

    if (data.adjustmentType === 'custom') {
      if (data.customAdjustmentInterest === undefined || data.customAdjustmentInterest < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter the interest amount charged for the partial period',
          path: ['customAdjustmentInterest'],
        });
      }
      if (data.customAdjustmentPrincipal === undefined || data.customAdjustmentPrincipal < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter the principal amount (use 0 if none was charged)',
          path: ['customAdjustmentPrincipal'],
        });
      }
    }

    if (data.emiCalculationMode === 'fixed') {
      if (!data.fixedEmiAmount || data.fixedEmiAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter the fixed EMI amount your bank charges',
          path: ['fixedEmiAmount'],
        });
        return;
      }

      const minEmi = calculateMinimumFixedEMI(data.principal, data.insuranceAmount, data.interestRate);
      if (data.fixedEmiAmount <= minEmi) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Fixed EMI must be greater than first-month interest (${Math.ceil(minEmi)}). Otherwise the loan will never be repaid.`,
          path: ['fixedEmiAmount'],
        });
      }

      const formulaEmi = calculateTotalLoanEMI(
        data.principal,
        data.insuranceAmount,
        data.interestRate,
        data.tenureMonths,
      );
      if (formulaEmi > 0 && data.fixedEmiAmount < formulaEmi * 0.5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Fixed EMI seems too low compared to the calculated EMI. Double-check the amount.',
          path: ['fixedEmiAmount'],
        });
      }
    }

    if (hasMoratoriumPeriod(data.startDate, data.emiStartDate)) {
      const loanStart = isoDateStringToDate(data.startDate);
      const emiStart = isoDateStringToDate(data.emiStartDate);

      for (const [index, disb] of (data.disbursements ?? []).entries()) {
        const disbDate = isoDateStringToDate(disb.date);
        if (disbDate < loanStart || disbDate > emiStart) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tranche date must be between loan start and first EMI date',
            path: ['disbursements', index, 'date'],
          });
        }
      }

      for (const [index, change] of (data.moratoriumRateChanges ?? []).entries()) {
        const changeDate = isoDateStringToDate(change.date);
        if (changeDate < loanStart || changeDate > emiStart) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Rate change date must be between loan start and first EMI date',
            path: ['moratoriumRateChanges', index, 'date'],
          });
        }
      }

      const trancheTotal = (data.disbursements ?? []).reduce((sum, row) => sum + row.amount, 0);
      const effectiveDisbursed = trancheTotal > 0 ? trancheTotal : (data.disbursedPrincipal ?? 0);

      if (effectiveDisbursed > data.principal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Total disbursed amount cannot exceed the repayment principal (outstanding at first EMI)',
          path: trancheTotal > 0 ? ['disbursements'] : ['disbursedPrincipal'],
        });
      }
    }
  });

export type LoanFormValues = z.infer<typeof loanFormSchema>;
