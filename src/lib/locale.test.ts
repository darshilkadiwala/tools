import { describe, expect, it } from 'vitest';

import { formatLocaleNumber, getNumberLocale, parseLocaleNumber, sanitizeDecimalInput } from '@/lib/locale';

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

  it('parses decimal input with a dot', () => {
    expect(parseLocaleNumber('8.5', { allowDecimals: true })).toBe(8.5);
    expect(parseLocaleNumber('10.55', { allowDecimals: true })).toBe(10.55);
  });

  it('parses decimal input with a comma from numpad decimal', () => {
    expect(parseLocaleNumber('8,5', { allowDecimals: true })).toBe(8.5);
    expect(parseLocaleNumber('10,55', { allowDecimals: true })).toBe(10.55);
  });
});

describe('sanitizeDecimalInput', () => {
  it('keeps a trailing decimal while typing', () => {
    expect(sanitizeDecimalInput('8.')).toBe('8.');
    expect(sanitizeDecimalInput('10.')).toBe('10.');
  });

  it('normalizes comma to dot and strips invalid characters', () => {
    expect(sanitizeDecimalInput('8,9')).toBe('8.9');
    expect(sanitizeDecimalInput('8a.9b')).toBe('8.9');
  });

  it('allows only one decimal separator', () => {
    expect(sanitizeDecimalInput('8.9.1')).toBe('8.91');
  });
});
