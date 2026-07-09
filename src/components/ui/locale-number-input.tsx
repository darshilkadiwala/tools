import { forwardRef, type ComponentProps, type JSX } from 'react';

import { Input } from '@/components/ui/input';
import { formatLocaleNumber, parseLocaleNumber } from '@/lib/locale';

interface LocaleNumberInputProps extends Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  allowDecimals?: boolean;
  selectOnFocus?: boolean;
}

const LocaleNumberInput = forwardRef<HTMLInputElement, LocaleNumberInputProps>(function LocaleNumberInput(
  { value, onChange, allowDecimals = false, selectOnFocus, ...props },
  ref,
): JSX.Element {
  const displayValue = value ? formatLocaleNumber(value, { allowDecimals }) : '';

  return (
    <Input
      ref={ref}
      type='text'
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={displayValue}
      selectOnFocus={selectOnFocus}
      onChange={(event) => {
        onChange(parseLocaleNumber(event.target.value, { allowDecimals }));
      }}
      {...props}
    />
  );
});

export { LocaleNumberInput };
