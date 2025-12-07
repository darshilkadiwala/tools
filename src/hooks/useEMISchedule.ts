import { useCallback, useEffect, useState } from 'react';

import { generateEMISchedule, getEMIStatus } from '@/lib/calculations';
import { db } from '@/lib/db';

import type { EMIScheduleEntry } from '@/types';

export function useEMISchedule(loanId: string | null) {
  const [schedule, setSchedule] = useState<EMIScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSchedule = useCallback(async () => {
    if (!loanId) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const emiSchedule = await db.emiSchedules.where('loanId').equals(loanId).sortBy('emiNumber');

      if (emiSchedule.length === 0) {
        // Generate schedule if it doesn't exist
        const loan = await db.loans.get(loanId);
        if (loan) {
          const modifications = await db.modifications.where('loanId').equals(loanId).toArray();

          const newSchedule = generateEMISchedule(loan, modifications);
          try {
            // Use bulkPut instead of bulkAdd to handle cases where entries might already exist
            await db.emiSchedules.bulkPut(newSchedule);
            // Reload schedule from DB to ensure we have the actual stored data
            const savedSchedule = await db.emiSchedules.where('loanId').equals(loanId).sortBy('emiNumber');
            setSchedule(savedSchedule);
          } catch (err) {
            // If bulkPut fails, try to load existing schedule (might have been partially created)
            const existingSchedule = await db.emiSchedules.where('loanId').equals(loanId).sortBy('emiNumber');
            if (existingSchedule.length > 0) {
              setSchedule(existingSchedule);
            } else {
              throw err;
            }
          }
        } else {
          setSchedule([]);
        }
      } else {
        // Update statuses based on current date
        const updatedSchedule = emiSchedule.map((emi) => {
          const newStatus = getEMIStatus(emi.dueDate, emi.status);
          if (newStatus !== emi.status) {
            // Update in database if status changed
            db.emiSchedules.update(emi.id, { status: newStatus }).catch(console.error);
            return { ...emi, status: newStatus };
          }
          return emi;
        });
        setSchedule(updatedSchedule);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load EMI schedule'));
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const regenerateSchedule = useCallback(async () => {
    if (!loanId) return;

    try {
      const loan = await db.loans.get(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      const modifications = await db.modifications.where('loanId').equals(loanId).toArray();

      // Delete existing schedule
      await db.emiSchedules.where('loanId').equals(loanId).delete();

      // Generate new schedule
      const newSchedule = generateEMISchedule(loan, modifications);
      // Use bulkPut to ensure entries are added/updated correctly
      await db.emiSchedules.bulkPut(newSchedule);

      await loadSchedule();
      return newSchedule;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to regenerate schedule');
    }
  }, [loanId, loadSchedule]);

  const markAsPaid = useCallback(
    async (emiId: string) => {
      try {
        await db.emiSchedules.update(emiId, { status: 'paid' });
        await loadSchedule();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to mark EMI as paid');
      }
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
  };
}
