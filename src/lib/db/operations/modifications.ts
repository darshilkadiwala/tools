import { db } from '@/lib/db/database';

import type { LoanModification } from '@/types';

export async function getModificationsByLoanId(loanId: string): Promise<LoanModification[]> {
  return db.modifications.where('loanId').equals(loanId).toArray();
}

export async function addModification(modification: LoanModification): Promise<void> {
  await db.modifications.add(modification);
}
