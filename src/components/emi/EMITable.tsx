import type { JSX } from 'react';

import { format } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, Edit } from 'lucide-react';

import { EmiNumberCell } from '@/components/emi/EmiNumberCell';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/calculations';
import { formatEmiNumberLabel } from '@/lib/emi-label';
import { formatEntryInterestRate, type ScheduleRateContext } from '@/lib/schedule-rate';
import { cn, isoToDate } from '@/lib/utils';

import type { EMIScheduleEntry } from '@/types';

interface EMITableProps {
  schedule: EMIScheduleEntry[];
  rateContext?: ScheduleRateContext;
  onSelectionChange?: (entryIds: string[]) => void;
  selectedEntryIds?: string[];
  embedded?: boolean;
}

export function EMITable({
  schedule,
  rateContext,
  onSelectionChange,
  selectedEntryIds = [],
  embedded = false,
}: EMITableProps): JSX.Element {
  const showSelection = !!onSelectionChange;

  const handleRowClick = (entryId: string): void => {
    if (!onSelectionChange) return;

    if (selectedEntryIds.includes(entryId)) {
      onSelectionChange(selectedEntryIds.filter((id) => id !== entryId));
    } else {
      onSelectionChange([...selectedEntryIds, entryId]);
    }
  };

  const handleSelectAll = (checked: boolean): void => {
    if (!onSelectionChange) return;

    const pageIds = schedule.map((emi) => emi.id);

    if (checked) {
      onSelectionChange([...new Set([...selectedEntryIds, ...pageIds])]);
    } else {
      onSelectionChange(selectedEntryIds.filter((id) => !pageIds.includes(id)));
    }
  };

  const allSelected = schedule.length > 0 && schedule.every((emi) => selectedEntryIds.includes(emi.id));

  const someSelected = schedule.length > 0 && schedule.some((emi) => selectedEntryIds.includes(emi.id)) && !allSelected;

  const getStatusIcon = (status: EMIScheduleEntry['status']): JSX.Element => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className='h-4 w-4 text-green-500' />;
      case 'modified':
        return <Edit className='h-4 w-4 text-blue-500' />;
      case 'upcoming':
        return <Clock className='h-4 w-4 text-blue-500' />;
      case 'pending':
        return <AlertCircle className='h-4 w-4 text-yellow-500' />;
      default:
        return <AlertCircle className='h-4 w-4 text-gray-500' />;
    }
  };

  return (
    <div className={cn('overflow-x-auto', embedded ? 'border-t' : 'rounded-md border')}>
      <Table>
        <TableHeader>
          <TableRow>
            {showSelection && (
              <TableHead className='w-12'>
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={handleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                  aria-label='Select all rows'
                />
              </TableHead>
            )}
            <TableHead>EMI #</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className='text-right'>Principal</TableHead>
            <TableHead className='text-right'>Interest</TableHead>
            <TableHead className='text-right'>Total</TableHead>
            <TableHead className='text-right'>Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='text-right'>Interest Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showSelection ? 10 : 9} className='text-muted-foreground py-8 text-center'>
                No EMI schedule available
              </TableCell>
            </TableRow>
          ) : (
            schedule.map((emi) => (
              <TableRow
                key={emi.id}
                onClick={() => handleRowClick(emi.id)}
                className={`${showSelection ? 'cursor-pointer' : ''} ${selectedEntryIds.includes(emi.id) ? 'bg-muted' : ''}`}>
                {showSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedEntryIds.includes(emi.id)}
                      onCheckedChange={() => handleRowClick(emi.id)}
                      aria-label={`Select ${formatEmiNumberLabel(emi, { includeDisbursementLabel: true })}`}
                    />
                  </TableCell>
                )}
                <TableCell className='font-medium'>
                  <EmiNumberCell emi={emi} />
                </TableCell>
                <TableCell>{format(isoToDate(emi.dueDate), 'MMM dd, yyyy')}</TableCell>
                <TableCell className='text-right'>{formatCurrency(emi.principal)}</TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(emi.interest)}
                  {emi.isAdjustment && emi.adjustmentComponents && emi.adjustmentComponents.length > 0 && (
                    <p className='text-muted-foreground mt-1 text-xs font-normal'>
                      {emi.adjustmentComponents
                        .map((component) => `${component.label}: ${formatCurrency(component.interest)}`)
                        .join(' · ')}
                    </p>
                  )}
                </TableCell>
                <TableCell className='text-right font-medium'>{formatCurrency(emi.total)}</TableCell>
                <TableCell className='text-right'>{formatCurrency(emi.outstandingPrincipal)}</TableCell>
                <TableCell>
                  <div className='flex items-center gap-2'>
                    {getStatusIcon(emi.status)}
                    <span className='capitalize'>{emi.status}</span>
                  </div>
                </TableCell>
                <TableCell className='text-right'>{formatEntryInterestRate(emi, rateContext)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
