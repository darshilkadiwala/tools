import { forwardRef, useState, type ChangeEvent, type ComponentProps, type FocusEvent, type JSX } from 'react';

import { Input } from '@/components/ui/input';
import { formatInputNumber, getNumberLocale, parseLocaleNumber } from '@/lib/locale';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  currency?: string;
  locale?: string;
}

function formatCurrencyValue(value: number, currency: string, locale: string): string {
  if (value === 0) {
    return '';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onChange, currency = 'INR', locale = getNumberLocale(), className, onBlur, onFocus, ...props },
  ref,
): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = isFocused ? draft : formatCurrencyValue(value, currency, locale);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.target.value;
    setDraft(raw);
    onChange(parseLocaleNumber(raw));
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
    setIsFocused(true);
    setDraft(formatInputNumber(value, false));
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    setIsFocused(false);
    const parsed = parseLocaleNumber(draft);
    onChange(parsed);
    setDraft(formatInputNumber(parsed, false));
    onBlur?.(event);
  };

  return (
    <Input
      ref={ref}
      type='text'
      inputMode='numeric'
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(className)}
      {...props}
    />
  );
});

export { CurrencyInput };
