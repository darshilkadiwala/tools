import { getDisplaySequenceNumber, resolveEntryKind, type ScheduleEntryIdentity } from '@/lib/schedule-entry';

import type { EMIScheduleEntry } from '@/types';

export type EmiLabelEntry = ScheduleEntryIdentity & Pick<EMIScheduleEntry, 'disbursementLabel'>;

interface FormatEmiNumberLabelOptions {
  /** Include tranche label inline (for CSV/export). UI shows it as muted subtext instead. */
  includeDisbursementLabel?: boolean;
}

/** Human-readable EMI # label for tables, dialogs, and exports. */
export function formatEmiNumberLabel(emi: EmiLabelEntry, options?: FormatEmiNumberLabelOptions): string {
  const entryKind = resolveEntryKind(emi);
  const sequence = getDisplaySequenceNumber(emi);

  if (entryKind === 'disbursement') {
    const base = `Disbursement ${sequence}`;
    if (options?.includeDisbursementLabel && emi.disbursementLabel) {
      return `${base} (${emi.disbursementLabel})`;
    }
    return base;
  }

  if (entryKind === 'moratorium') {
    return `Moratorium ${sequence}`;
  }

  if (entryKind === 'adjustment') {
    return 'Adjustment';
  }

  return String(sequence);
}
