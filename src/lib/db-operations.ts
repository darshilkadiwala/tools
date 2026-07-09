import { getEMIStatus } from '@/lib/calculations';
import { db } from '@/lib/db';

import type { EMIScheduleEntry, LoanModification } from '@/types';

export async function bulkUpdateEMISchedules(entries: EMIScheduleEntry[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await db.transaction('rw', db.emiSchedules, async () => {
    await db.emiSchedules.bulkPut(entries);
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

export async function deleteLoanData(loanId: string): Promise<void> {
  await db.transaction('rw', [db.loans, db.emiSchedules, db.modifications], async () => {
    await db.emiSchedules.where('loanId').equals(loanId).delete();
    await db.modifications.where('loanId').equals(loanId).delete();
    await db.loans.delete(loanId);
  });
}

export async function addModification(modification: LoanModification): Promise<void> {
  await db.modifications.add(modification);
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
