import type { JSX } from 'react';

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = 'Loading...' }: PageLoaderProps): JSX.Element {
  return (
    <div className='flex items-center justify-center py-16'>
      <div className='text-center'>
        <div className='border-primary mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2' />
        <p className='text-muted-foreground'>{message}</p>
      </div>
    </div>
  );
}
