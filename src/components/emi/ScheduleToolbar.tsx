import type { JSX, ReactNode } from 'react';

import {
  ArrowDownUp,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Download,
  Percent,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type DueDateSort = 'asc' | 'desc';

interface ScheduleStats {
  pending: number;
  paid: number;
  upcoming: number;
  total: number;
  filtered: number;
}

interface ScheduleToolbarProps {
  stats: ScheduleStats;
  availableYears: number[];
  effectiveYear: number | null;
  dueDateSort: DueDateSort;
  onYearChange: (value: string) => void;
  onSortChange: (value: DueDateSort) => void;
  onPrepayment?: () => void;
  onStepUp?: () => void;
  onInterestChange?: () => void;
  onMarkAllPending?: () => void;
  onUpdateEMIDates: () => void;
  onRegenerate: () => void;
  onExport: () => void;
  canExport: boolean;
}

function StatBadge({
  count,
  label,
  dotClassName,
}: {
  count: number;
  label: string;
  dotClassName: string;
}): JSX.Element {
  return (
    <span className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
      <span className={cn('size-2 rounded-full', dotClassName)} />
      <span className='text-foreground font-medium'>{count}</span> {label}
    </span>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = 'outline',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'outline' | 'default' | 'ghost';
}): JSX.Element {
  return (
    <Button type='button' variant={variant} size='sm' onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}

export function ScheduleToolbar({
  stats,
  availableYears,
  effectiveYear,
  dueDateSort,
  onYearChange,
  onSortChange,
  onPrepayment,
  onStepUp,
  onInterestChange,
  onMarkAllPending,
  onUpdateEMIDates,
  onRegenerate,
  onExport,
  canExport,
}: ScheduleToolbarProps): JSX.Element {
  const hasLoanActions = onPrepayment || onStepUp || onInterestChange;

  return (
    <div className='bg-muted/20 space-y-4 p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Transactions</h2>
          <p className='text-muted-foreground text-sm'>
            {stats.filtered === stats.total ? `${stats.total} EMIs` : `${stats.filtered} of ${stats.total} EMIs`}
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <StatBadge count={stats.pending} label='pending' dotClassName='bg-amber-500' />
          <StatBadge count={stats.paid} label='paid' dotClassName='bg-green-500' />
          <StatBadge count={stats.upcoming} label='upcoming' dotClassName='bg-blue-500' />
        </div>
      </div>

      {hasLoanActions && (
        <>
          <div className='flex flex-wrap gap-2'>
            {onPrepayment && (
              <ActionButton icon={<Wallet className='h-4 w-4' />} label='Pre-payment' onClick={onPrepayment} />
            )}
            {onStepUp && (
              <ActionButton icon={<TrendingUp className='h-4 w-4' />} label='Step-up EMI' onClick={onStepUp} />
            )}
            {onInterestChange && (
              <ActionButton
                icon={<Percent className='h-4 w-4' />}
                label='Change Interest Rate'
                onClick={onInterestChange}
              />
            )}
          </div>
          <Separator />
        </>
      )}

      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2'>
            <Label htmlFor='year-filter' className='text-muted-foreground flex items-center gap-1.5 text-xs'>
              <Calendar className='h-3.5 w-3.5' />
              Year
            </Label>
            <Select value={effectiveYear === null ? 'all' : effectiveYear.toString()} onValueChange={onYearChange}>
              <SelectTrigger id='year-filter' className='h-8 w-28 text-sm'>
                <SelectValue placeholder='Year' />
              </SelectTrigger>
              <SelectContent className='max-h-[200px]' position='popper'>
                <SelectItem value='all'>All Years</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center gap-2'>
            <Label htmlFor='sort-filter' className='text-muted-foreground flex items-center gap-1.5 text-xs'>
              <ArrowDownUp className='h-3.5 w-3.5' />
              Sort
            </Label>
            <Select value={dueDateSort} onValueChange={(value) => onSortChange(value as DueDateSort)}>
              <SelectTrigger id='sort-filter' className='h-8 w-32 text-sm'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position='popper'>
                <SelectItem value='desc'>Newest First</SelectItem>
                <SelectItem value='asc'>Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {stats.pending > 0 && onMarkAllPending && (
            <Button type='button' variant='warning' size='sm' onClick={onMarkAllPending}>
              <CheckCircle2 className='h-4 w-4' />
              Mark All Pending ({stats.pending})
            </Button>
          )}

          <div className='bg-border hidden h-6 w-px sm:block' />

          <Button type='button' variant='ghost' size='sm' onClick={onUpdateEMIDates}>
            <CalendarDays className='h-4 w-4' />
            <span className='hidden sm:inline'>Update Dates</span>
          </Button>
          <Button type='button' variant='ghost' size='sm' onClick={onRegenerate}>
            <RefreshCw className='h-4 w-4' />
            <span className='hidden sm:inline'>Regenerate</span>
          </Button>
          <Button type='button' variant='ghost' size='sm' onClick={onExport} disabled={!canExport}>
            <Download className='h-4 w-4' />
            <span className='hidden sm:inline'>Export</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
