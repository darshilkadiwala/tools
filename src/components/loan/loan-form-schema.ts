import { z } from 'zod';

import { needsAdjustmentPayment } from '@/lib/calculations';
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
  });

export type LoanFormValues = z.infer<typeof loanFormSchema>;
