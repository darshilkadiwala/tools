import Dexie, { type Table } from 'dexie';

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
  }
}

export const db = new LoanDatabase();
