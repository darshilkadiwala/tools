import { forwardRef, useState, type ChangeEvent, type ComponentProps, type FocusEvent, type JSX } from 'react';

import { Input } from '@/components/ui/input';
import { formatInputNumber, parseLocaleNumber, sanitizeDecimalInput } from '@/lib/locale';
import { cn } from '@/lib/utils';

interface PercentageInputProps extends Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const PercentageInput = forwardRef<HTMLInputElement, PercentageInputProps>(function PercentageInput(
  { value, onChange, min = 0, max = 100, className, onBlur, onFocus, ...props },
  ref,
): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = isFocused ? draft : formatInputNumber(value, true);

  const clamp = (amount: number): number => Math.max(min, Math.min(max, amount));

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const sanitized = sanitizeDecimalInput(event.target.value);
    setDraft(sanitized);
    onChange(clamp(parseLocaleNumber(sanitized, { allowDecimals: true })));
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
    setIsFocused(true);
    setDraft(formatInputNumber(value, true));
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    setIsFocused(false);
    const parsed = clamp(parseLocaleNumber(draft, { allowDecimals: true }));
    onChange(parsed);
    setDraft(formatInputNumber(parsed, true));
    onBlur?.(event);
  };

  return (
    <div className='relative'>
      <Input
        ref={ref}
        type='text'
        inputMode='decimal'
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn('pr-8', className)}
        {...props}
      />
      <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2'>%</span>
    </div>
  );
});

export { PercentageInput };
