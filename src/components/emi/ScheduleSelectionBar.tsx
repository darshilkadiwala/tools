import type { JSX } from 'react';

import { CheckCircle2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ScheduleSelectionBarProps {
  selectedCount: number;
  payableCount: number;
  isProcessing: boolean;
  onMarkAsPaid: () => void;
  onClearSelection: () => void;
}

export function ScheduleSelectionBar({
  selectedCount,
  payableCount,
  isProcessing,
  onMarkAsPaid,
  onClearSelection,
}: ScheduleSelectionBarProps): JSX.Element | null {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className='bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-10 border-t px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <p className='text-sm font-medium'>
            {selectedCount} {selectedCount === 1 ? 'row' : 'rows'} selected
          </p>
          <Button type='button' variant='ghost' size='sm' onClick={onClearSelection} disabled={isProcessing}>
            <X className='mr-1 h-4 w-4' />
            Clear
          </Button>
        </div>
        <Button type='button' size='sm' onClick={onMarkAsPaid} disabled={isProcessing || payableCount === 0}>
          <CheckCircle2 className='mr-2 h-4 w-4' />
          {isProcessing ? 'Updating...' : `Mark ${payableCount} as Paid`}
        </Button>
      </div>
    </div>
  );
}
