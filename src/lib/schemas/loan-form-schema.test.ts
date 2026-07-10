import { describe, expect, it } from 'vitest';

import { loanFormSchema } from '@/lib/schemas/loan-form-schema';

const validBase = {
  name: 'Test Loan',
  type: 'home' as const,
  principal: 1_000_000,
  interestRate: 8.5,
  tenureMonths: 240,
  startDate: '2024-08-31',
  emiStartDate: '2024-09-14',
  adjustmentType: 'interest_only' as const,
};

describe('loanFormSchema', () => {
  it('rejects first EMI date before loan start date', () => {
    const result = loanFormSchema.safeParse({
      ...validBase,
      emiStartDate: '2024-08-15',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('emiStartDate'))).toBe(true);
    }
  });

  it('accepts first EMI date equal to loan start date', () => {
    const result = loanFormSchema.safeParse({
      ...validBase,
      startDate: '2024-09-14',
      emiStartDate: '2024-09-14',
    });

    expect(result.success).toBe(true);
  });
});
