import { forwardRef, type ComponentProps, type FocusEvent, type JSX } from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends ComponentProps<'input'> {
  /** When false (default), focused inputs place the caret at the end instead of selecting all text. */
  selectOnFocus?: boolean;
}

function getNumberInputMode(step?: string | number): 'decimal' | 'numeric' {
  if (step === undefined || step === 'any' || step === 1 || step === '1') {
    return 'numeric';
  }
  return 'decimal';
}

function placeCaretAtEnd(input: HTMLInputElement): void {
  const { selectionStart, selectionEnd, value } = input;
  if (value.length === 0) {
    return;
  }

  if (selectionStart === 0 && selectionEnd === value.length) {
    const position = value.length;
    input.setSelectionRange(position, position);
  }
}

function collapseSelectionOnFocus(input: HTMLInputElement): void {
  placeCaretAtEnd(input);
  requestAnimationFrame(() => placeCaretAtEnd(input));
  setTimeout(() => placeCaretAtEnd(input), 0);
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, selectOnFocus = false, onFocus, inputMode, step, ...props },
  ref,
): JSX.Element {
  const useTextForNumber = type === 'number' && !selectOnFocus;
  const resolvedType = useTextForNumber ? 'text' : type;
  const resolvedInputMode = useTextForNumber ? (inputMode ?? getNumberInputMode(step)) : inputMode;

  const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
    if (!selectOnFocus) {
      collapseSelectionOnFocus(event.currentTarget);
    }

    onFocus?.(event);
  };

  return (
    <input
      ref={ref}
      type={resolvedType}
      inputMode={resolvedInputMode}
      step={useTextForNumber ? undefined : step}
      data-slot='input'
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      onFocus={handleFocus}
      {...props}
    />
  );
});

export { Input };
