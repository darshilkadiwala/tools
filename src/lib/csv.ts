import { formatEmiNumberLabel } from '@/lib/emi-label';
import { formatEntryInterestRate, type ScheduleRateContext } from '@/lib/schedule-rate';
import { isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry } from '@/types';

function escapeCSVValue(value: string | number): string {
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function exportScheduleToCSV(
  schedule: EMIScheduleEntry[],
  loanId: string,
  yearLabel: string,
  rateContext?: ScheduleRateContext,
): void {
  if (schedule.length === 0) {
    return;
  }

  const headers = [
    'EMI #',
    'Due Date',
    'Principal',
    'Interest',
    'Total',
    'Outstanding Principal',
    'Status',
    'Interest Rate',
  ];
  const rows = schedule.map((emi) => [
    formatEmiNumberLabel(emi, { includeDisbursementLabel: true }),
    isoToDate(emi.dueDate).toISOString().split('T')[0],
    emi.principal,
    emi.interest,
    emi.total,
    emi.outstandingPrincipal,
    emi.status,
    formatEntryInterestRate(emi, rateContext),
  ]);

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => escapeCSVValue(cell)).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `emi-schedule-${loanId}-${yearLabel}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  anchor.remove();
}
