import { describe, expect, it } from 'vitest';

import type { EMIScheduleEntry } from '@/types';

import {
  getMaxRegularEmiNumber,
  isRegularEmiEntry,
  normalizeScheduleEntry,
  sortScheduleEntries,
} from './schedule-entry';

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

describe('schedule-entry', () => {
  it('normalizes legacy negative moratorium numbers', () => {
    const normalized = normalizeScheduleEntry(
      createEntry({
        id: 'loan-1-moratorium-3',
        emiNumber: -3,
        isMoratorium: true,
        principal: 0,
      }),
    );

    expect(normalized.entryKind).toBe('moratorium');
    expect(normalized.emiNumber).toBe(3);
  });

  it('normalizes legacy negative disbursement numbers from id', () => {
    const normalized = normalizeScheduleEntry(
      createEntry({
        id: 'loan-1-disb-2',
        emiNumber: -1002,
        isMoratorium: true,
        isDisbursement: true,
      }),
    );

    expect(normalized.entryKind).toBe('disbursement');
    expect(normalized.emiNumber).toBe(2);
  });

  it('sorts by due date then entry kind', () => {
    const sorted = sortScheduleEntries([
      createEntry({ id: 'emi-2', emiNumber: 2, dueDate: '2024-02-01T00:00:00.000Z', entryKind: 'emi' }),
      createEntry({
        id: 'loan-1-moratorium-1',
        emiNumber: 1,
        dueDate: '2024-01-31T00:00:00.000Z',
        entryKind: 'moratorium',
        isMoratorium: true,
        principal: 0,
      }),
      createEntry({
        id: 'loan-1-disb-1',
        emiNumber: 1,
        dueDate: '2024-01-15T00:00:00.000Z',
        entryKind: 'disbursement',
        isMoratorium: true,
        isDisbursement: true,
      }),
      createEntry({ id: 'emi-1', emiNumber: 1, dueDate: '2024-03-01T00:00:00.000Z', entryKind: 'emi' }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['loan-1-disb-1', 'loan-1-moratorium-1', 'emi-2', 'emi-1']);
  });

  it('returns max regular EMI number only', () => {
    const max = getMaxRegularEmiNumber([
      createEntry({ emiNumber: 84, entryKind: 'emi' }),
      createEntry({ id: 'loan-1-moratorium-1', emiNumber: 65, entryKind: 'moratorium', isMoratorium: true }),
    ]);

    expect(max).toBe(84);
    expect(isRegularEmiEntry(createEntry({ entryKind: 'emi' }))).toBe(true);
    expect(isRegularEmiEntry(createEntry({ entryKind: 'moratorium', isMoratorium: true }))).toBe(false);
  });
});
