import type { JSX, ReactNode } from 'react';

import { CircleHelp } from 'lucide-react';

import { FormLabel } from '@/components/ui/form';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FieldLabelProps {
  children: ReactNode;
  help?: string;
  className?: string;
}

export function FieldLabel({ children, help, className }: FieldLabelProps): JSX.Element {
  return (
    <div className='flex items-center gap-1.5'>
      <FormLabel className={cn('text-sm font-medium', className)}>{children}</FormLabel>
      {help && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground inline-flex rounded-sm transition-colors'
              aria-label='More information'>
              <CircleHelp className='size-3.5' />
            </button>
          </TooltipTrigger>
          <TooltipContent side='top' className='max-w-xs text-xs leading-relaxed'>
            {help}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
