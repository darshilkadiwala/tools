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
 * Restrict decimal input to digits and a single decimal separator while typing.
 * Preserves intermediate values like "8." until the user finishes entering.
 */
export function sanitizeDecimalInput(input: string): string {
  let normalized = input;

  if (!normalized.includes('.') && normalized.includes(',')) {
    const lastComma = normalized.lastIndexOf(',');
    normalized = `${normalized.slice(0, lastComma).replace(/,/g, '')}.${normalized.slice(lastComma + 1)}`;
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  normalized = normalized.replace(/[^\d.]/g, '');

  const dotIndex = normalized.indexOf('.');
  if (dotIndex === -1) {
    return normalized;
  }

  const beforeDot = normalized.slice(0, dotIndex + 1);
  const afterDot = normalized.slice(dotIndex + 1).replace(/\./g, '');
  return beforeDot + afterDot;
}

export function formatInputNumber(value: number, allowDecimals: boolean): string {
  if (value === 0) {
    return '';
  }

  return formatLocaleNumber(value, { allowDecimals });
}

/**
 * Parse user input that may contain locale-specific grouping separators.
 */
export function parseLocaleNumber(input: string, options?: ParseLocaleNumberOptions): number {
  if (!input.trim()) {
    return 0;
  }

  if (options?.allowDecimals) {
    let normalized = input.trim();

    // Numpad decimal often inserts "," on locale keyboards (e.g. en-IN) while the main
    // keyboard period key inserts ".". Treat a lone comma as the decimal separator.
    if (!normalized.includes('.') && normalized.includes(',')) {
      const lastComma = normalized.lastIndexOf(',');
      normalized = `${normalized.slice(0, lastComma).replace(/,/g, '')}.${normalized.slice(lastComma + 1)}`;
    } else {
      normalized = normalized.replace(/,/g, '');
    }

    const cleaned = normalized.replace(/[^\d.]/g, '');
    const [whole = '', ...fractionParts] = cleaned.split('.');
    const numeric = fractionParts.length > 0 ? `${whole}.${fractionParts.join('')}` : whole;
    return parseFloat(numeric) || 0;
  }

  const digitsOnly = input.replace(/\D/g, '');
  return parseInt(digitsOnly, 10) || 0;
}
