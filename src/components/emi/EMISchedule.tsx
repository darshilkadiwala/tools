import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import { getYear } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { PageLoader } from '@/components/ui/page-loader';
import { useEMISchedule } from '@/contexts/EMIScheduleContext';
import { useScheduleUrlFilters, type DueDateSort } from '@/hooks/useScheduleUrlFilters';
import { exportScheduleToCSV } from '@/lib/csv';
import { getMaxRegularEmiNumber } from '@/lib/schedule-entry';
import type { ScheduleRateContext } from '@/lib/schedule-rate';
import { isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry } from '@/types';

import { EMITable } from './EMITable';
import { MarkAllPendingPaidDialog } from './MarkAllPendingPaidDialog';
import { RegenerateScheduleDialog } from './RegenerateScheduleDialog';
import { ScheduleSelectionBar } from './ScheduleSelectionBar';
import { ScheduleToolbar } from './ScheduleToolbar';
import { UpdateEMIDateDialog } from './UpdateEMIDateDialog';

const PAGE_SIZE = 12;

interface ScheduleView {
  availableYears: number[];
  effectiveYear: number | null;
  filteredSchedule: EMIScheduleEntry[];
  displaySchedule: EMIScheduleEntry[];
  totalPages: number;
  safeCurrentPage: number;
  showPagination: boolean;
}

interface EMIScheduleProps {
  loanId: string;
  rateContext?: ScheduleRateContext;
  onPrepayment?: () => void;
  onStepUp?: () => void;
  onInterestChange?: () => void;
  onSelectedEntryIdsChange?: (entryIds: string[]) => void;
  selectedEntryIds?: string[];
}

function resolveEffectiveYear(
  selectedYear: number | null,
  availableYears: number[],
  currentYear: number,
): number | null {
  if (selectedYear === null) {
    return null;
  }
  if (availableYears.length === 0 || availableYears.includes(selectedYear)) {
    return selectedYear;
  }
  return availableYears.includes(currentYear) ? currentYear : availableYears[availableYears.length - 1];
}

function buildScheduleView(
  schedule: EMIScheduleEntry[],
  selectedYear: number | null,
  dueDateSort: DueDateSort,
  currentPage: number,
  currentYear: number,
): ScheduleView {
  const years = new Set<number>();
  const entries = schedule.map((emi) => {
    const dueDate = isoToDate(emi.dueDate);
    const year = getYear(dueDate);
    years.add(year);
    return { emi, dueDate, year };
  });

  const availableYears = Array.from(years).sort((a, b) => a - b);
  const effectiveYear = resolveEffectiveYear(selectedYear, availableYears, currentYear);
  const sortMultiplier = dueDateSort === 'desc' ? -1 : 1;

  const filteredSchedule = entries
    .filter(({ year }) => effectiveYear === null || year === effectiveYear)
    .sort((a, b) => sortMultiplier * (a.dueDate.getTime() - b.dueDate.getTime()))
    .map(({ emi }) => emi);

  const totalPages = Math.max(1, Math.ceil(filteredSchedule.length / PAGE_SIZE));
  const showPagination = effectiveYear === null && filteredSchedule.length > PAGE_SIZE;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const displaySchedule = showPagination
    ? filteredSchedule.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE)
    : filteredSchedule;

  return {
    availableYears,
    effectiveYear,
    filteredSchedule,
    displaySchedule,
    totalPages,
    safeCurrentPage,
    showPagination,
  };
}

interface SchedulePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

function SchedulePagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: SchedulePaginationProps): JSX.Element {
  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalItems);

  return (
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <p className='text-muted-foreground text-sm'>
        Showing {rangeStart}-{rangeEnd} of {totalItems}
      </p>
      <div className='flex items-center gap-2'>
        <Button variant='outline' size='sm' onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
          <ChevronLeft className='h-4 w-4' />
          Previous
        </Button>
        <span className='text-sm'>
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant='outline'
          size='sm'
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}>
          Next
          <ChevronRight className='h-4 w-4' />
        </Button>
      </div>
    </div>
  );
}

export function EMISchedule({
  loanId,
  rateContext,
  onPrepayment,
  onStepUp,
  onInterestChange,
  onSelectedEntryIdsChange,
  selectedEntryIds: externalSelectedEntryIds,
}: EMIScheduleProps): JSX.Element {
  const { schedule, loading, error, regenerateSchedule, refreshSchedule, markAsPaidBulk } = useEMISchedule();
  const { selectedYear, dueDateSort, currentPage, setSelectedYear, setDueDateSort, setCurrentPage } =
    useScheduleUrlFilters();
  const [internalSelectedEntryIds, setInternalSelectedEntryIds] = useState<string[]>([]);
  const [showUpdateEMIDate, setShowUpdateEMIDate] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showMarkAllPendingConfirm, setShowMarkAllPendingConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isMarkingAllPending, setIsMarkingAllPending] = useState(false);

  const selectedEntryIds = externalSelectedEntryIds ?? internalSelectedEntryIds;
  const currentYear = new Date().getFullYear();

  const {
    availableYears,
    effectiveYear,
    filteredSchedule,
    displaySchedule,
    totalPages,
    safeCurrentPage,
    showPagination,
  } = useMemo(
    () => buildScheduleView(schedule, selectedYear, dueDateSort, currentPage, currentYear),
    [schedule, selectedYear, dueDateSort, currentPage, currentYear],
  );

  const handleSelectedEntryIdsChange = useCallback(
    (entryIds: string[]): void => {
      if (onSelectedEntryIdsChange) {
        onSelectedEntryIdsChange(entryIds);
      } else {
        setInternalSelectedEntryIds(entryIds);
      }
    },
    [onSelectedEntryIdsChange],
  );

  const selectedEntries = useMemo(
    () => schedule.filter((emi) => selectedEntryIds.includes(emi.id)),
    [schedule, selectedEntryIds],
  );

  const payableEntryIds = useMemo(
    () => selectedEntries.filter((emi) => emi.status !== 'paid').map((emi) => emi.id),
    [selectedEntries],
  );

  const paidCount = useMemo(() => schedule.filter((emi) => emi.status === 'paid').length, [schedule]);

  const pendingEntries = useMemo(() => schedule.filter((emi) => emi.status === 'pending'), [schedule]);

  const scheduleStats = useMemo(
    () => ({
      pending: pendingEntries.length,
      paid: schedule.filter((emi) => emi.status === 'paid').length,
      upcoming: schedule.filter((emi) => emi.status === 'upcoming').length,
      total: schedule.length,
      filtered: filteredSchedule.length,
    }),
    [schedule, pendingEntries.length, filteredSchedule.length],
  );

  const handleYearChange = useCallback(
    (value: string): void => {
      setSelectedYear(value === 'all' ? null : Number.parseInt(value, 10));
    },
    [setSelectedYear],
  );

  const handleSortChange = useCallback(
    (value: DueDateSort): void => {
      setDueDateSort(value);
    },
    [setDueDateSort],
  );

  useEffect(() => {
    if (showPagination && safeCurrentPage !== currentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [showPagination, safeCurrentPage, currentPage, setCurrentPage]);

  const handleExport = useCallback((): void => {
    exportScheduleToCSV(filteredSchedule, loanId, effectiveYear?.toString() ?? 'all', rateContext);
  }, [filteredSchedule, loanId, effectiveYear, rateContext]);

  const handleRegenerate = useCallback(async (): Promise<void> => {
    try {
      setActionError(null);
      setIsRegenerating(true);
      await regenerateSchedule();
      setShowRegenerateConfirm(false);
      handleSelectedEntryIdsChange([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to regenerate schedule');
    } finally {
      setIsRegenerating(false);
    }
  }, [regenerateSchedule, handleSelectedEntryIdsChange]);

  const handleMarkAsPaid = useCallback(async (): Promise<void> => {
    if (payableEntryIds.length === 0) {
      return;
    }

    try {
      setActionError(null);
      setIsMarkingPaid(true);
      await markAsPaidBulk(payableEntryIds);
      handleSelectedEntryIdsChange([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark EMIs as paid');
    } finally {
      setIsMarkingPaid(false);
    }
  }, [payableEntryIds, markAsPaidBulk, handleSelectedEntryIdsChange]);

  const handleMarkAllPendingAsPaid = useCallback(async (): Promise<void> => {
    const pendingIds = pendingEntries.map((emi) => emi.id);
    if (pendingIds.length === 0) {
      return;
    }

    try {
      setActionError(null);
      setIsMarkingAllPending(true);
      await markAsPaidBulk(pendingIds);
      setShowMarkAllPendingConfirm(false);
      handleSelectedEntryIdsChange([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark pending EMIs as paid');
    } finally {
      setIsMarkingAllPending(false);
    }
  }, [pendingEntries, markAsPaidBulk, handleSelectedEntryIdsChange]);

  if (loading) {
    return <PageLoader message='Loading EMI schedule...' />;
  }

  if (error) {
    return <InlineError message={error.message} />;
  }

  return (
    <div className='space-y-4'>
      {actionError && <InlineError message={actionError} />}

      <div className={selectedEntryIds.length > 0 ? 'pb-20' : undefined}>
        <div className='overflow-hidden rounded-lg border'>
          <ScheduleToolbar
            stats={scheduleStats}
            availableYears={availableYears}
            effectiveYear={effectiveYear}
            dueDateSort={dueDateSort}
            onYearChange={handleYearChange}
            onSortChange={handleSortChange}
            onPrepayment={onPrepayment}
            onStepUp={onStepUp}
            onInterestChange={onInterestChange}
            onMarkAllPending={pendingEntries.length > 0 ? (): void => setShowMarkAllPendingConfirm(true) : undefined}
            onUpdateEMIDates={() => setShowUpdateEMIDate(true)}
            onRegenerate={() => setShowRegenerateConfirm(true)}
            onExport={handleExport}
            canExport={filteredSchedule.length > 0}
          />

          <EMITable
            schedule={displaySchedule}
            rateContext={rateContext}
            onSelectionChange={handleSelectedEntryIdsChange}
            selectedEntryIds={selectedEntryIds}
            embedded
          />
        </div>

        {showPagination && (
          <div className='pt-3'>
            <SchedulePagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredSchedule.length}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <ScheduleSelectionBar
        selectedCount={selectedEntryIds.length}
        payableCount={payableEntryIds.length}
        isProcessing={isMarkingPaid}
        onMarkAsPaid={() => void handleMarkAsPaid()}
        onClearSelection={() => handleSelectedEntryIdsChange([])}
      />

      <UpdateEMIDateDialog
        open={showUpdateEMIDate}
        onOpenChange={setShowUpdateEMIDate}
        loanId={loanId}
        maxEMINumber={getMaxRegularEmiNumber(schedule)}
        onSuccess={() => {
          setShowUpdateEMIDate(false);
          void refreshSchedule();
        }}
      />

      <RegenerateScheduleDialog
        open={showRegenerateConfirm}
        onOpenChange={setShowRegenerateConfirm}
        paidCount={paidCount}
        isProcessing={isRegenerating}
        onConfirm={() => void handleRegenerate()}
      />

      <MarkAllPendingPaidDialog
        open={showMarkAllPendingConfirm}
        onOpenChange={setShowMarkAllPendingConfirm}
        pendingEntries={pendingEntries}
        rateContext={rateContext}
        isProcessing={isMarkingAllPending}
        onConfirm={() => void handleMarkAllPendingAsPaid()}
      />
    </div>
  );
}
