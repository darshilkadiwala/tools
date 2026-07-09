import { describe, expect, it } from 'vitest';

import { formatLocaleNumber, getNumberLocale, parseLocaleNumber } from '@/lib/locale';

describe('getNumberLocale', () => {
  it('defaults to Indian grouping for INR amounts', () => {
    expect(getNumberLocale()).toBe('en-IN');
  });
});

describe('formatLocaleNumber', () => {
  it('formats with Indian grouping', () => {
    expect(formatLocaleNumber(3_400_000, { locale: 'en-IN' })).toBe('34,00,000');
    expect(formatLocaleNumber(135_116, { locale: 'en-IN' })).toBe('1,35,116');
  });

  it('formats with US grouping', () => {
    expect(formatLocaleNumber(1_000_111, { locale: 'en-US' })).toBe('1,000,111');
  });
});

describe('parseLocaleNumber', () => {
  it('parses grouped Indian input', () => {
    expect(parseLocaleNumber('34,00,000')).toBe(3_400_000);
    expect(parseLocaleNumber('1,35,116')).toBe(135_116);
  });

  it('parses grouped US input', () => {
    expect(parseLocaleNumber('1,000,111')).toBe(1_000_111);
  });

  it('parses plain digits', () => {
    expect(parseLocaleNumber('3400000')).toBe(3_400_000);
  });

  it('returns 0 for empty input', () => {
    expect(parseLocaleNumber('')).toBe(0);
    expect(parseLocaleNumber('   ')).toBe(0);
  });
});
