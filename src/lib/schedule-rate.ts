import { getEffectiveMoratoriumRate } from '@/lib/calculations/moratorium';
import { resolveEntryKind } from '@/lib/schedule-entry';
import { isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry, MoratoriumRateChange } from '@/types';

export interface ScheduleRateContext {
  baseInterestRate: number;
  moratoriumRateChanges?: MoratoriumRateChange[];
}

export function resolveEntryInterestRate(emi: EMIScheduleEntry, context: ScheduleRateContext): number {
  if (emi.modifiedInterestRate !== undefined) {
    return emi.modifiedInterestRate;
  }

  if (resolveEntryKind(emi) === 'moratorium' || resolveEntryKind(emi) === 'disbursement') {
    return getEffectiveMoratoriumRate(
      isoToDate(emi.dueDate),
      context.baseInterestRate,
      context.moratoriumRateChanges ?? [],
    );
  }

  return context.baseInterestRate;
}

export function formatEntryInterestRate(emi: EMIScheduleEntry, context: ScheduleRateContext | undefined): string {
  if (!context) {
    return emi.modifiedInterestRate !== undefined ? `${emi.modifiedInterestRate.toFixed(2)}%` : '—';
  }

  return `${resolveEntryInterestRate(emi, context).toFixed(2)}%`;
}
