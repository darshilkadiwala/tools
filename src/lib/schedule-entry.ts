import { isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry, ScheduleEntryKind } from '@/types';

const ENTRY_KIND_ORDER: Record<ScheduleEntryKind, number> = {
  disbursement: 0,
  moratorium: 1,
  adjustment: 2,
  emi: 3,
};

export type ScheduleEntryIdentity = Pick<
  EMIScheduleEntry,
  'id' | 'emiNumber' | 'entryKind' | 'isAdjustment' | 'isMoratorium' | 'isDisbursement'
>;

/** Resolve entry kind from stored field or legacy boolean flags. */
export function resolveEntryKind(entry: ScheduleEntryIdentity): ScheduleEntryKind {
  if (entry.entryKind) {
    return entry.entryKind;
  }
  if (entry.isDisbursement) {
    return 'disbursement';
  }
  if (entry.isMoratorium) {
    return 'moratorium';
  }
  if (entry.isAdjustment) {
    return 'adjustment';
  }
  return 'emi';
}

export function isRegularEmiEntry(entry: EMIScheduleEntry): boolean {
  return resolveEntryKind(entry) === 'emi';
}

export function getMaxRegularEmiNumber(schedule: EMIScheduleEntry[]): number {
  return schedule.reduce((max, entry) => {
    if (!isRegularEmiEntry(entry)) {
      return max;
    }
    return Math.max(max, entry.emiNumber);
  }, 0);
}

function parseLegacyEmiNumber(entry: ScheduleEntryIdentity, entryKind: ScheduleEntryKind): number {
  if (entry.emiNumber >= 0) {
    return entry.emiNumber;
  }

  if (entryKind === 'disbursement') {
    const match = entry.id.match(/-disb-(\d+)$/);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10);
    }
    return Math.abs(entry.emiNumber) - 1000;
  }

  if (entryKind === 'moratorium') {
    const match = entry.id.match(/-moratorium-(\d+)$/);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10);
    }
    return Math.abs(entry.emiNumber);
  }

  return entry.emiNumber;
}

export function getDisplaySequenceNumber(entry: ScheduleEntryIdentity): number {
  const entryKind = resolveEntryKind(entry);
  return parseLegacyEmiNumber(entry, entryKind);
}

/** Normalize legacy rows (negative emiNumber) to positive sequence + entryKind. */
export function normalizeScheduleEntry(entry: EMIScheduleEntry): EMIScheduleEntry {
  const entryKind = resolveEntryKind(entry);
  const emiNumber = parseLegacyEmiNumber(entry, entryKind);

  return {
    ...entry,
    entryKind,
    emiNumber,
    isDisbursement: entryKind === 'disbursement',
    isMoratorium: entryKind === 'moratorium' || entryKind === 'disbursement',
    isAdjustment: entryKind === 'adjustment',
  };
}

export function compareScheduleEntries(a: EMIScheduleEntry, b: EMIScheduleEntry): number {
  const dateDiff = isoToDate(a.dueDate).getTime() - isoToDate(b.dueDate).getTime();
  if (dateDiff !== 0) {
    return dateDiff;
  }

  const kindDiff = ENTRY_KIND_ORDER[resolveEntryKind(a)] - ENTRY_KIND_ORDER[resolveEntryKind(b)];
  if (kindDiff !== 0) {
    return kindDiff;
  }

  return a.emiNumber - b.emiNumber;
}

export function sortScheduleEntries(entries: EMIScheduleEntry[]): EMIScheduleEntry[] {
  return [...entries].sort(compareScheduleEntries);
}

export function normalizeAndSortSchedule(entries: EMIScheduleEntry[]): EMIScheduleEntry[] {
  return sortScheduleEntries(entries.map(normalizeScheduleEntry));
}
