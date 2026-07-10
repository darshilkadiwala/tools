import { describe, expect, it } from 'vitest';

import type { EMIScheduleEntry } from '@/types';

import { formatEntryInterestRate, resolveEntryInterestRate } from './schedule-rate';

function createEntry(overrides: Partial<EMIScheduleEntry> = {}): EMIScheduleEntry {
  return {
    id: 'loan-1-emi-1',
    loanId: 'loan-1',
    emiNumber: 1,
    dueDate: '2024-01-01T00:00:00.000Z',
    principal: 1000,
    interest: 500,
    total: 1500,
    outstandingPrincipal: 90_000,
    status: 'pending',
    ...overrides,
  };
}

const rateContext = {
  baseInterestRate: 10.55,
  moratoriumRateChanges: [{ date: '2019-10-15T00:00:00.000Z', newInterestRate: 10.05 }],
};

describe('schedule-rate', () => {
  it('uses stored rate when present', () => {
    expect(resolveEntryInterestRate(createEntry({ modifiedInterestRate: 11.25 }), rateContext)).toBe(11.25);
  });

  it('resolves moratorium rate from loan context for legacy rows', () => {
    expect(
      resolveEntryInterestRate(
        createEntry({
          dueDate: '2019-11-30T00:00:00.000Z',
          isMoratorium: true,
          emiNumber: -1,
        }),
        rateContext,
      ),
    ).toBe(10.05);
  });

  it('falls back to base loan rate for regular EMIs', () => {
    expect(resolveEntryInterestRate(createEntry(), rateContext)).toBe(10.55);
  });

  it('formats rate for display', () => {
    expect(formatEntryInterestRate(createEntry({ modifiedInterestRate: 9.75 }), rateContext)).toBe('9.75%');
  });
});
