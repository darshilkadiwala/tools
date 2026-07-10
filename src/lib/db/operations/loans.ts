import { db } from '@/lib/db/database';

import type { Loan } from '@/types';

export async function getAllLoans(): Promise<Loan[]> {
  return db.loans.toArray();
}

export async function getLoanById(id: string): Promise<Loan | undefined> {
  return db.loans.get(id);
}

export async function createLoan(loan: Loan): Promise<void> {
  await db.loans.add(loan);
}

export async function saveLoan(loan: Loan): Promise<void> {
  await db.loans.put(loan);
}

export async function deleteLoanData(loanId: string): Promise<void> {
  await db.transaction('rw', [db.loans, db.emiSchedules, db.modifications], async () => {
    await db.emiSchedules.where('loanId').equals(loanId).delete();
    await db.modifications.where('loanId').equals(loanId).delete();
    await db.loans.delete(loanId);
  });
}
