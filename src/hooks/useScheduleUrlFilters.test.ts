import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCHEDULE_PAGE,
  DEFAULT_SCHEDULE_SORT,
  parseSchedulePageParam,
  parseScheduleSortParam,
  parseScheduleYearParam,
  serializeSchedulePageParam,
  serializeScheduleSortParam,
  serializeScheduleYearParam,
} from './useScheduleUrlFilters';

describe('useScheduleUrlFilters helpers', () => {
  it('defaults year to all years', () => {
    expect(parseScheduleYearParam(null)).toBeNull();
    expect(parseScheduleYearParam('all')).toBeNull();
  });

  it('parses a numeric year', () => {
    expect(parseScheduleYearParam('2019')).toBe(2019);
    expect(parseScheduleYearParam('invalid')).toBeNull();
  });

  it('defaults sort to oldest first', () => {
    expect(DEFAULT_SCHEDULE_SORT).toBe('asc');
    expect(parseScheduleSortParam(null)).toBe('asc');
    expect(parseScheduleSortParam('asc')).toBe('asc');
    expect(parseScheduleSortParam('desc')).toBe('desc');
  });

  it('omits default values from the URL', () => {
    expect(serializeScheduleYearParam(null)).toBeNull();
    expect(serializeScheduleSortParam('asc')).toBeNull();
    expect(serializeSchedulePageParam(DEFAULT_SCHEDULE_PAGE)).toBeNull();
    expect(serializeScheduleYearParam(2024)).toBe('2024');
    expect(serializeScheduleSortParam('desc')).toBe('desc');
    expect(serializeSchedulePageParam(3)).toBe('3');
  });

  it('defaults page to 1 and rejects invalid values', () => {
    expect(DEFAULT_SCHEDULE_PAGE).toBe(1);
    expect(parseSchedulePageParam(null)).toBe(1);
    expect(parseSchedulePageParam('3')).toBe(3);
    expect(parseSchedulePageParam('0')).toBe(1);
    expect(parseSchedulePageParam('invalid')).toBe(1);
  });
});
