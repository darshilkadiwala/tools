import { describe, expect, it } from 'vitest';

import {
  applyInterestRounding,
  calculateActual365Interest,
  calculateAdjustmentPreview,
  calculateEMI,
  calculateTotalLoanEMI,
  explainInterestVariance,
  generateEMISchedule,
  getCurrentOutstanding,
  getEMIStatus,
  getLoanComponents,
  needsAdjustmentPayment,
  recalculateAfterPrepayment,
  recalculateInterestRate,
} from '@/lib/calculations';

import type { EMIScheduleEntry, Loan } from '@/types';

const baseLoan: Loan = {
  id: 'loan-1',
  name: 'Test Loan',
  type: 'home',
  principal: 1_000_000,
  interestRate: 8.5,
  tenureMonths: 12,
  startDate: '2024-01-01T00:00:00.000Z',
  emiAmount: calculateEMI(1_000_000, 8.5, 12),
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function createScheduleEntry(overrides: Partial<EMIScheduleEntry>): EMIScheduleEntry {
  return {
    id: 'emi-1',
    loanId: baseLoan.id,
    emiNumber: 1,
    dueDate: '2025-01-01T00:00:00.000Z',
    principal: 80_000,
    interest: 7_083,
    total: 87_083,
    outstandingPrincipal: 920_000,
    status: 'pending',
    ...overrides,
  };
}

describe('calculateEMI', () => {
  it('calculates a standard EMI amount', () => {
    const emi = calculateEMI(1_000_000, 8.5, 240);
    expect(emi).toBeGreaterThan(0);
    expect(emi).toBeLessThan(20_000);
  });

  it('returns zero when tenure is zero', () => {
    expect(calculateEMI(1_000_000, 8.5, 0)).toBe(0);
  });

  it('handles zero interest rate', () => {
    expect(calculateEMI(120_000, 0, 12)).toBe(10_000);
  });
});

describe('getEMIStatus', () => {
  it('keeps paid and modified statuses', () => {
    expect(getEMIStatus('2020-01-01T00:00:00.000Z', 'paid')).toBe('paid');
    expect(getEMIStatus('2030-01-01T00:00:00.000Z', 'modified')).toBe('modified');
  });

  it('marks future due dates as upcoming', () => {
    expect(getEMIStatus('2099-01-01T00:00:00.000Z')).toBe('upcoming');
  });

  it('marks past due dates as pending instead of auto-paid', () => {
    expect(getEMIStatus('2020-01-01T00:00:00.000Z')).toBe('pending');
  });
});

describe('getCurrentOutstanding', () => {
  it('returns total principal when no EMIs are paid', () => {
    const schedule = [
      createScheduleEntry({ emiNumber: 0, outstandingPrincipal: 3_535_116 }),
      createScheduleEntry({ id: 'emi-1', emiNumber: 1, outstandingPrincipal: 3_525_689 }),
    ];

    expect(getCurrentOutstanding(schedule, 3_535_116)).toBe(3_535_116);
  });

  it('returns balance after the last paid EMI', () => {
    const schedule = [
      createScheduleEntry({ emiNumber: 0, status: 'paid', outstandingPrincipal: 3_535_116 }),
      createScheduleEntry({ id: 'emi-1', emiNumber: 1, status: 'paid', outstandingPrincipal: 3_525_689 }),
      createScheduleEntry({ id: 'emi-2', emiNumber: 2, outstandingPrincipal: 3_516_193 }),
    ];

    expect(getCurrentOutstanding(schedule, 3_535_116)).toBe(3_525_689);
  });

  it('returns 0 when all EMIs are paid', () => {
    const schedule = [createScheduleEntry({ emiNumber: 1, status: 'paid', outstandingPrincipal: 0 })];

    expect(getCurrentOutstanding(schedule, 1_000_000)).toBe(0);
  });
});

describe('recalculateAfterPrepayment', () => {
  it('reduces outstanding principal after prepayment', () => {
    const schedule = [
      createScheduleEntry({ emiNumber: 1, outstandingPrincipal: 900_000 }),
      createScheduleEntry({ id: 'emi-2', emiNumber: 2, outstandingPrincipal: 820_000 }),
      createScheduleEntry({ id: 'emi-3', emiNumber: 3, outstandingPrincipal: 740_000 }),
    ];

    const result = recalculateAfterPrepayment(baseLoan, 50_000, 1, schedule, false);

    expect(result.updatedSchedule[1]?.outstandingPrincipal).toBeLessThan(820_000);
    expect(result.updatedSchedule[2]?.outstandingPrincipal).toBeLessThan(740_000);
  });
});

describe('recalculateInterestRate', () => {
  it('updates pending EMIs with the new interest rate', () => {
    const schedule = [
      createScheduleEntry({ emiNumber: 1, status: 'paid', outstandingPrincipal: 900_000 }),
      createScheduleEntry({ id: 'emi-2', emiNumber: 2, outstandingPrincipal: 820_000 }),
      createScheduleEntry({ id: 'emi-3', emiNumber: 3, outstandingPrincipal: 740_000 }),
    ];

    const updated = recalculateInterestRate(baseLoan, 10, [2, 3], schedule);

    expect(updated[1]?.modifiedInterestRate).toBe(10);
    expect(updated[2]?.modifiedInterestRate).toBe(10);
    expect(updated[1]?.interest).not.toBe(schedule[1]?.interest);
  });
});

describe('needsAdjustmentPayment', () => {
  it('returns true when disbursement and first EMI are in different months', () => {
    expect(needsAdjustmentPayment('2024-08-31', '2024-09-14')).toBe(true);
  });

  it('returns false when dates are the same', () => {
    expect(needsAdjustmentPayment('2024-09-14', '2024-09-14')).toBe(false);
  });
});

describe('calculateAdjustmentPreview', () => {
  it('returns proportional and interest-only previews', () => {
    const preview = calculateAdjustmentPreview(3_534_812, 8.9, 180, '2024-08-31', '2024-09-14');

    expect(preview.needsAdjustment).toBe(true);
    expect(preview.daysFromStart).toBe(1);
    expect(preview.proportional.principal).toBeGreaterThan(0);
    expect(preview.interestOnly.principal).toBe(0);
    expect(preview.interestOnly.interest).toBeGreaterThan(0);
  });
});

describe('generateEMISchedule adjustment types', () => {
  const partialPeriodLoan: Loan = {
    ...baseLoan,
    principal: 3_534_812,
    interestRate: 8.9,
    tenureMonths: 180,
    startDate: '2024-08-31T00:00:00.000Z',
    emiStartDate: '2024-09-14T00:00:00.000Z',
    emiAmount: calculateEMI(3_534_812, 8.9, 180),
  };

  it('creates interest-only adjustment without principal', () => {
    const schedule = generateEMISchedule({ ...partialPeriodLoan, adjustmentType: 'interest_only' });
    const adjustment = schedule.find((emi) => emi.isAdjustment);

    expect(adjustment).toBeDefined();
    expect(adjustment?.principal).toBe(0);
    expect(adjustment?.interest).toBeGreaterThan(0);
    expect(adjustment?.outstandingPrincipal).toBe(partialPeriodLoan.principal);
  });

  it('skips adjustment row when type is none', () => {
    const schedule = generateEMISchedule({ ...partialPeriodLoan, adjustmentType: 'none' });

    expect(schedule.some((emi) => emi.isAdjustment)).toBe(false);
  });

  it('uses custom adjustment amounts', () => {
    const schedule = generateEMISchedule({
      ...partialPeriodLoan,
      adjustmentType: 'custom',
      customAdjustmentPrincipal: 0,
      customAdjustmentInterest: 830,
    });
    const adjustment = schedule.find((emi) => emi.isAdjustment);

    expect(adjustment?.principal).toBe(0);
    expect(adjustment?.interest).toBe(830);
    expect(adjustment?.total).toBe(830);
  });
});

describe('explainInterestVariance', () => {
  it('explains why bank interest can be lower than our calculation', () => {
    const analysis = explainInterestVariance(3_535_116, 8.9, 846, 830, 1, 31, {
      calculatedPrincipal: 304,
      bankPrincipal: 0,
    });

    expect(analysis).not.toBeNull();
    expect(analysis?.difference).toBe(16);
  });
});

describe('split home + insurance loan', () => {
  const homeLoan = {
    id: 'loan-home',
    name: 'Home Loan',
    type: 'home' as const,
    principal: 3_400_000,
    insuranceAmount: 135_116,
    interestRate: 8.9,
    tenureMonths: 180,
    startDate: '2024-08-31T00:00:00.000Z',
    emiStartDate: '2024-09-14T00:00:00.000Z',
    adjustmentType: 'interest_only' as const,
    emiAmount: calculateTotalLoanEMI(3_400_000, 135_116, 8.9, 180),
    createdAt: '2024-08-31T00:00:00.000Z',
    updatedAt: '2024-08-31T00:00:00.000Z',
  };

  it('calculates separate EMIs matching bank split', () => {
    const components = getLoanComponents(homeLoan);
    expect(Math.round(components[0].emiAmount)).toBe(34283);
    expect(Math.round(components[1].emiAmount)).toBe(1362);
    expect(Math.round(homeLoan.emiAmount)).toBe(35646);
  });

  it('calculates broken-period interest per sub-loan using actual/365', () => {
    expect(calculateActual365Interest(3_400_000, 8.9, 1, 'round')).toBe(829);
    expect(calculateActual365Interest(135_116, 8.9, 1, 'round')).toBe(33);
    expect(calculateActual365Interest(3_400_000, 8.9, 1, 'ceil')).toBe(830);
    expect(calculateActual365Interest(135_116, 8.9, 1, 'ceil')).toBe(33);

    const preview = calculateAdjustmentPreview(3_400_000, 8.9, 180, '2024-08-31', '2024-09-14', 135_116, 'round');

    expect(preview.splitInterestOnly?.components[0]?.interest).toBe(829);
    expect(preview.splitInterestOnly?.components[1]?.interest).toBe(33);
    expect(preview.splitInterestOnly?.total.interest).toBe(862);
  });

  it('matches bank totals when rounding up each sub-loan interest', () => {
    const preview = calculateAdjustmentPreview(3_400_000, 8.9, 180, '2024-08-31', '2024-09-14', 135_116, 'ceil');

    expect(preview.splitInterestOnly?.components[0]?.interest).toBe(830);
    expect(preview.splitInterestOnly?.components[1]?.interest).toBe(33);
    expect(preview.splitInterestOnly?.total.interest).toBe(863);

    const schedule = generateEMISchedule({ ...homeLoan, interestRounding: 'ceil' });
    const adjustment = schedule.find((emi) => emi.isAdjustment);

    expect(adjustment?.interest).toBe(863);
    expect(adjustment?.adjustmentComponents).toEqual([
      { label: 'Principal', principal: 0, interest: 830 },
      { label: 'Insurance', principal: 0, interest: 33 },
    ]);
  });

  it('generates adjustment row with per-component interest breakdown', () => {
    const schedule = generateEMISchedule(homeLoan);
    const adjustment = schedule.find((emi) => emi.isAdjustment);

    expect(adjustment?.principal).toBe(0);
    expect(adjustment?.interest).toBe(862);
    expect(adjustment?.adjustmentComponents).toEqual([
      { label: 'Principal', principal: 0, interest: 829 },
      { label: 'Insurance', principal: 0, interest: 33 },
    ]);
    expect(adjustment?.outstandingPrincipal).toBe(3_535_116);
  });
});

describe('applyInterestRounding', () => {
  it('rounds using the selected mode', () => {
    expect(applyInterestRounding(829.04, 'round')).toBe(829);
    expect(applyInterestRounding(829.04, 'ceil')).toBe(830);
    expect(applyInterestRounding(829.04, 'floor')).toBe(829);
  });
});
