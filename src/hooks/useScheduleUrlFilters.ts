import { useCallback, useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

export type DueDateSort = 'asc' | 'desc';

export const DEFAULT_SCHEDULE_SORT: DueDateSort = 'asc';
export const DEFAULT_SCHEDULE_PAGE = 1;

export function parseScheduleYearParam(param: string | null): number | null {
  if (!param || param === 'all') {
    return null;
  }

  const parsed = Number.parseInt(param, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseScheduleSortParam(param: string | null): DueDateSort {
  return param === 'desc' ? 'desc' : DEFAULT_SCHEDULE_SORT;
}

export function serializeScheduleYearParam(year: number | null): string | null {
  return year === null ? null : year.toString();
}

export function serializeScheduleSortParam(sort: DueDateSort): string | null {
  return sort === DEFAULT_SCHEDULE_SORT ? null : sort;
}

export function parseSchedulePageParam(param: string | null): number {
  if (!param) {
    return DEFAULT_SCHEDULE_PAGE;
  }

  const parsed = Number.parseInt(param, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_SCHEDULE_PAGE;
  }

  return parsed;
}

export function serializeSchedulePageParam(page: number): string | null {
  return page === DEFAULT_SCHEDULE_PAGE ? null : page.toString();
}

interface ScheduleUrlFilters {
  selectedYear: number | null;
  dueDateSort: DueDateSort;
  currentPage: number;
  setSelectedYear: (year: number | null) => void;
  setDueDateSort: (sort: DueDateSort) => void;
  setCurrentPage: (page: number) => void;
}

export function useScheduleUrlFilters(): ScheduleUrlFilters {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedYear = useMemo(() => parseScheduleYearParam(searchParams.get('year')), [searchParams]);
  const dueDateSort = useMemo(() => parseScheduleSortParam(searchParams.get('sort')), [searchParams]);
  const currentPage = useMemo(() => parseSchedulePageParam(searchParams.get('page')), [searchParams]);

  const setSelectedYear = useCallback(
    (year: number | null): void => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const serialized = serializeScheduleYearParam(year);

          if (serialized === null) {
            next.delete('year');
          } else {
            next.set('year', serialized);
          }

          next.delete('page');

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setDueDateSort = useCallback(
    (sort: DueDateSort): void => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const serialized = serializeScheduleSortParam(sort);

          if (serialized === null) {
            next.delete('sort');
          } else {
            next.set('sort', serialized);
          }

          next.delete('page');

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setCurrentPage = useCallback(
    (page: number): void => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const serialized = serializeSchedulePageParam(page);

          if (serialized === null) {
            next.delete('page');
          } else {
            next.set('page', serialized);
          }

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    selectedYear,
    dueDateSort,
    currentPage,
    setSelectedYear,
    setDueDateSort,
    setCurrentPage,
  };
}
