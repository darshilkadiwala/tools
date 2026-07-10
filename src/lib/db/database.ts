// eslint-disable-next-line import/no-named-as-default
import Dexie, { type Table } from 'dexie';

import { normalizeScheduleEntry } from '@/lib/schedule-entry';

import type { EMIScheduleEntry, Loan, LoanModification } from '@/types';

export class LoanDatabase extends Dexie {
  loans!: Table<Loan, string>;
  emiSchedules!: Table<EMIScheduleEntry, string>;
  modifications!: Table<LoanModification, string>;

  constructor() {
    super('LoanDatabase');

    this.version(1).stores({
      loans: 'id, name, type, startDate, createdAt',
      emiSchedules: 'id, loanId, emiNumber, dueDate, status',
      modifications: 'id, loanId, type, date',
    });

    this.version(2)
      .stores({
        loans: 'id, name, type, startDate, createdAt',
        emiSchedules: 'id, loanId, emiNumber, dueDate, status, entryKind',
        modifications: 'id, loanId, type, date',
      })
      .upgrade(async (transaction) => {
        const table = transaction.table<EMIScheduleEntry, string>('emiSchedules');
        const entries = await table.toArray();
        await table.bulkPut(entries.map(normalizeScheduleEntry));
      });
  }
}

export const db = new LoanDatabase();
