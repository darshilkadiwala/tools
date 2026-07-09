const APP_NUMBER_LOCALE = 'en-IN';

/**
 * Locale used for number grouping in inputs and currency display.
 * Defaults to Indian grouping (en-IN) since this app uses INR throughout.
 */
export function getNumberLocale(): string {
  return APP_NUMBER_LOCALE;
}

export interface FormatLocaleNumberOptions {
  allowDecimals?: boolean;
  locale?: string;
}

/**
 * Format a number with locale-specific thousand separators.
 */
export function formatLocaleNumber(value: number, options?: FormatLocaleNumberOptions): string {
  const locale = options?.locale ?? getNumberLocale();

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: options?.allowDecimals ? 10 : 0,
    minimumFractionDigits: 0,
  }).format(value);
}

export interface ParseLocaleNumberOptions {
  allowDecimals?: boolean;
}

/**
 * Parse user input that may contain locale-specific grouping separators.
 */
export function parseLocaleNumber(input: string, options?: ParseLocaleNumberOptions): number {
  if (!input.trim()) {
    return 0;
  }

  if (options?.allowDecimals) {
    const cleaned = input.replace(/[^\d.]/g, '');
    const [whole = '', ...fractionParts] = cleaned.split('.');
    const normalized = fractionParts.length > 0 ? `${whole}.${fractionParts.join('')}` : whole;
    return parseFloat(normalized) || 0;
  }

  const digitsOnly = input.replace(/\D/g, '');
  return parseInt(digitsOnly, 10) || 0;
}
