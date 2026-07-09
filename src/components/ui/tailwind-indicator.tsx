import type { JSX } from 'react';

export function TailwindIndicator({ show = true }: { show?: boolean }): JSX.Element | null {
  if (!show || process.env.NODE_ENV === 'production') return null;

  return (
    <div className='bg-muted text-foreground ring-border fixed bottom-1 left-1 z-50 flex size-8 items-center justify-center rounded-md p-3 font-mono text-xs ring-1'>
      <div className='block sm:hidden'>xs</div>
      <div className='hidden sm:block md:hidden'>sm</div>
      <div className='hidden md:block lg:hidden'>md</div>
      <div className='hidden lg:block xl:hidden'>lg</div>
      <div className='hidden xl:block 2xl:hidden'>xl</div>
      <div className='3xl:hidden hidden 2xl:block'>2xl</div>
      <div className='3xl:block hidden'>3xl</div>
    </div>
  );
}
