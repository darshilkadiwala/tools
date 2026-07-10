import { useCallback, useEffect, useState } from 'react';

import { generateEMISchedule } from '@/lib/calculations';
import {
  applyScheduleWithStatuses,
  bulkUpdateEMISchedules,
  getLoanById,
  getModificationsByLoanId,
  getScheduleByLoanId,
  markEMIAsPaid,
  markEMIsAsPaidBulk,
  replaceLoanSchedule,
} from '@/lib/db';

import type { EMIScheduleEntry } from '@/types';

export interface EMIScheduleState {
  schedule: EMIScheduleEntry[];
  loading: boolean;
  error: Error | null;
  refreshSchedule: () => Promise<void>;
  regenerateSchedule: () => Promise<EMIScheduleEntry[]>;
  markAsPaid: (emiId: string) => Promise<void>;
  markAsPaidBulk: (emiIds: string[]) => Promise<void>;
}

export function useEMIScheduleState(loanId: string | null): EMIScheduleState {
  const [schedule, setSchedule] = useState<EMIScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSchedule = useCallback(async (): Promise<void> => {
    if (!loanId) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const emiSchedule = await getScheduleByLoanId(loanId);

      if (emiSchedule.length === 0) {
        const loan = await getLoanById(loanId);
        if (!loan) {
          setSchedule([]);
          setError(null);
          return;
        }

        const modifications = await getModificationsByLoanId(loanId);
        const newSchedule = generateEMISchedule(loan, modifications);
        await bulkUpdateEMISchedules(newSchedule);
        const savedSchedule = await getScheduleByLoanId(loanId);
        setSchedule(await applyScheduleWithStatuses(savedSchedule));
      } else {
        setSchedule(await applyScheduleWithStatuses(emiSchedule));
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load EMI schedule'));
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const regenerateSchedule = useCallback(async (): Promise<EMIScheduleEntry[]> => {
    if (!loanId) {
      return [];
    }

    const loan = await getLoanById(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    const modifications = await getModificationsByLoanId(loanId);
    const newSchedule = generateEMISchedule(loan, modifications);
    await replaceLoanSchedule(loanId, newSchedule);
    await loadSchedule();
    return newSchedule;
  }, [loanId, loadSchedule]);

  const markAsPaid = useCallback(
    async (emiId: string): Promise<void> => {
      await markEMIAsPaid(emiId);
      await loadSchedule();
    },
    [loadSchedule],
  );

  const markAsPaidBulk = useCallback(
    async (emiIds: string[]): Promise<void> => {
      await markEMIsAsPaidBulk(emiIds);
      await loadSchedule();
    },
    [loadSchedule],
  );

  return {
    schedule,
    loading,
    error,
    refreshSchedule: loadSchedule,
    regenerateSchedule,
    markAsPaid,
    markAsPaidBulk,
  };
}
