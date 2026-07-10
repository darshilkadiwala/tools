import { describe, expect, it } from 'vitest';

import type { EMIScheduleEntry } from '@/types';

import { formatEmiNumberLabel } from './emi-label';

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

describe('formatEmiNumberLabel', () => {
  it('formats regular EMIs as their number', () => {
    expect(formatEmiNumberLabel(createEntry({ emiNumber: 12, entryKind: 'emi' }))).toBe('12');
  });

  it('formats adjustment rows', () => {
    expect(formatEmiNumberLabel(createEntry({ emiNumber: 0, entryKind: 'adjustment', isAdjustment: true }))).toBe(
      'Adjustment',
    );
  });

  it('formats moratorium rows with a positive sequence number', () => {
    expect(
      formatEmiNumberLabel(
        createEntry({
          id: 'loan-1-moratorium-3',
          entryKind: 'moratorium',
          emiNumber: 3,
          isMoratorium: true,
          principal: 0,
        }),
      ),
    ).toBe('Moratorium 3');
  });

  it('formats disbursement rows with index and optional label', () => {
    expect(
      formatEmiNumberLabel(
        createEntry({
          id: 'loan-1-disb-2',
          entryKind: 'disbursement',
          emiNumber: 2,
          isMoratorium: true,
          isDisbursement: true,
          disbursementLabel: 'Semester 2',
        }),
      ),
    ).toBe('Disbursement 2');
  });

  it('includes disbursement label when requested for export', () => {
    expect(
      formatEmiNumberLabel(
        createEntry({
          id: 'loan-1-disb-2',
          entryKind: 'disbursement',
          emiNumber: 2,
          isMoratorium: true,
          isDisbursement: true,
          disbursementLabel: 'Semester 2',
        }),
        { includeDisbursementLabel: true },
      ),
    ).toBe('Disbursement 2 (Semester 2)');
  });

  it('normalizes legacy negative moratorium numbers for display', () => {
    expect(
      formatEmiNumberLabel(createEntry({ id: 'loan-1-moratorium-3', emiNumber: -3, isMoratorium: true, principal: 0 })),
    ).toBe('Moratorium 3');
  });
});
