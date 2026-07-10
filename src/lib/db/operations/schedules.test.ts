import { addMonths, parse } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  bulkUpdateEMISchedules,
  getScheduleByLoanId,
  markEMIAsPaid,
  markEMIsAsPaidBulk,
  updateEMIDateRange,
} from '@/lib/db';
import { db } from '@/lib/db/database';
import { dateToISO } from '@/lib/utils';

import type { EMIScheduleEntry } from '@/types';

const loanId = 'loan-test-1';

function createEntry(
  emiNumber: number,
  dueDate: string,
  status: EMIScheduleEntry['status'] = 'pending',
): EMIScheduleEntry {
  return {
    id: `${loanId}-emi-${emiNumber}`,
    loanId,
    emiNumber,
    dueDate,
    principal: 1000,
    interest: 500,
    total: 1500,
    outstandingPrincipal: 100_000 - emiNumber * 1000,
    status,
  };
}

describe('schedule operations', () => {
  beforeEach(async () => {
    await db.emiSchedules.clear();
  });

  it('returns schedule entries sorted by EMI number', async () => {
    await bulkUpdateEMISchedules([
      createEntry(2, '2025-02-01T00:00:00.000Z'),
      createEntry(1, '2025-01-01T00:00:00.000Z'),
    ]);

    const schedule = await getScheduleByLoanId(loanId);
    expect(schedule.map((entry) => entry.emiNumber)).toEqual([1, 2]);
  });

  it('marks a single EMI as paid', async () => {
    const entry = createEntry(1, '2025-01-01T00:00:00.000Z');
    await bulkUpdateEMISchedules([entry]);

    await markEMIAsPaid(entry.id);

    const updated = await getScheduleByLoanId(loanId);
    expect(updated[0]?.status).toBe('paid');
  });

  it('marks multiple EMIs as paid in bulk', async () => {
    const entries = [createEntry(1, '2025-01-01T00:00:00.000Z'), createEntry(2, '2025-02-01T00:00:00.000Z')];
    await bulkUpdateEMISchedules(entries);

    await markEMIsAsPaidBulk(entries.map((entry) => entry.id));

    const updated = await getScheduleByLoanId(loanId);
    expect(updated.every((entry) => entry.status === 'paid')).toBe(true);
  });

  it('updates due dates for an EMI range from a new start date', async () => {
    await bulkUpdateEMISchedules([
      createEntry(1, '2025-01-01T00:00:00.000Z'),
      createEntry(2, '2025-02-01T00:00:00.000Z'),
      createEntry(3, '2025-03-01T00:00:00.000Z'),
    ]);

    await updateEMIDateRange(loanId, 2, 3, '2025-06-15');

    const newStartDate = parse('2025-06-15', 'yyyy-MM-dd', new Date());
    const updated = await getScheduleByLoanId(loanId);
    expect(updated.find((entry) => entry.emiNumber === 1)?.dueDate).toBe('2025-01-01T00:00:00.000Z');
    expect(updated.find((entry) => entry.emiNumber === 2)?.dueDate).toBe(dateToISO(newStartDate));
    expect(updated.find((entry) => entry.emiNumber === 3)?.dueDate).toBe(
      dateToISO(addMonths(newStartDate, 1)),
    );
  });
});
