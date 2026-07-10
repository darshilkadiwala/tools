import { addMonths, parse } from 'date-fns';

import { getEMIStatus } from '@/lib/calculations';
import { db } from '@/lib/db/database';
import { isRegularEmiEntry, normalizeAndSortSchedule, normalizeScheduleEntry } from '@/lib/schedule-entry';
import { dateToISO } from '@/lib/utils';

import type { EMIScheduleEntry } from '@/types';

export async function getScheduleByLoanId(loanId: string): Promise<EMIScheduleEntry[]> {
  const entries = await db.emiSchedules.where('loanId').equals(loanId).toArray();
  return normalizeAndSortSchedule(entries);
}

export async function bulkUpdateEMISchedules(entries: EMIScheduleEntry[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const normalized = entries.map(normalizeScheduleEntry);

  await db.transaction('rw', db.emiSchedules, async () => {
    await db.emiSchedules.bulkPut(normalized);
  });
}

export async function replaceLoanSchedule(loanId: string, schedule: EMIScheduleEntry[]): Promise<void> {
  await db.transaction('rw', [db.emiSchedules, db.modifications], async () => {
    await db.emiSchedules.where('loanId').equals(loanId).delete();
    if (schedule.length > 0) {
      await db.emiSchedules.bulkPut(schedule);
    }
  });
}

export async function applyScheduleWithStatuses(entries: EMIScheduleEntry[]): Promise<EMIScheduleEntry[]> {
  const updatedEntries: EMIScheduleEntry[] = [];

  const schedule = entries.map((emi) => {
    const status = getEMIStatus(emi.dueDate, emi.status);
    if (status !== emi.status) {
      const updated = { ...emi, status };
      updatedEntries.push(updated);
      return updated;
    }
    return emi;
  });

  if (updatedEntries.length > 0) {
    await bulkUpdateEMISchedules(updatedEntries);
  }

  return schedule;
}

export async function markEMIAsPaid(emiId: string): Promise<void> {
  await db.emiSchedules.update(emiId, { status: 'paid' });
}

export async function markEMIsAsPaidBulk(emiIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(emiIds)];
  if (uniqueIds.length === 0) {
    return;
  }

  await db.transaction('rw', db.emiSchedules, async () => {
    await Promise.all(uniqueIds.map((id) => db.emiSchedules.update(id, { status: 'paid' })));
  });
}

export async function updateEMIDateRange(
  loanId: string,
  startEMINumber: number,
  endEMINumber: number,
  newStartDateString: string,
): Promise<void> {
  const allEMIs = await getScheduleByLoanId(loanId);
  const startEMI = allEMIs.find((emi) => isRegularEmiEntry(emi) && emi.emiNumber === startEMINumber);
  if (!startEMI) {
    throw new Error(`EMI number ${startEMINumber} not found`);
  }

  const newStartDate = parse(newStartDateString, 'yyyy-MM-dd', new Date());
  const updatedEMIs = allEMIs
    .filter((emi) => isRegularEmiEntry(emi) && emi.emiNumber >= startEMINumber && emi.emiNumber <= endEMINumber)
    .map((emi) => ({
      ...emi,
      dueDate: dateToISO(addMonths(newStartDate, emi.emiNumber - startEMINumber)),
    }));

  await bulkUpdateEMISchedules(updatedEMIs);
}
