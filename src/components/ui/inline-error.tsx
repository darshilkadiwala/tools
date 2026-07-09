import type { JSX } from 'react';

interface InlineErrorProps {
  message: string;
}

export function InlineError({ message }: InlineErrorProps): JSX.Element {
  return (
    <div className='bg-destructive/10 border-destructive/20 text-destructive rounded-md border px-3 py-2 text-sm'>
      {message}
    </div>
  );
}
