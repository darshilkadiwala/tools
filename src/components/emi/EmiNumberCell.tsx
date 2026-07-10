import type { JSX } from 'react';

import { formatEmiNumberLabel, type EmiLabelEntry } from '@/lib/emi-label';

interface EmiNumberCellProps {
  emi: EmiLabelEntry;
}

export function EmiNumberCell({ emi }: EmiNumberCellProps): JSX.Element {
  return (
    <>
      {formatEmiNumberLabel(emi)}
      {emi.isDisbursement && emi.disbursementLabel ? (
        <p className='text-muted-foreground mt-0.5 text-xs font-normal'>{emi.disbursementLabel}</p>
      ) : null}
    </>
  );
}
