import { useMemo, type JSX } from 'react';

import { Calculator, IndianRupee, Percent, Shield, Timer } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { calculateEMI, calculateTenureFromFixedEMI, formatCurrency, getLoanComponents } from '@/lib/calculations';
import { cn } from '@/lib/utils';

import type { EmiCalculationMode } from '@/types';

interface LoanEMIPreviewProps {
  principal: number;
  insuranceAmount: number;
  interestRate: number;
  tenureMonths: number;
  emiCalculationMode?: EmiCalculationMode;
  fixedEmiAmount?: number;
  className?: string;
}

function formatTenure(months: number): string {
  if (months <= 0) return '—';
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${months} mo`;
  if (remainingMonths === 0) return `${years} yr`;
  return `${years} yr ${remainingMonths} mo`;
}

export function LoanEMIPreview({
  principal,
  insuranceAmount,
  interestRate,
  tenureMonths,
  emiCalculationMode = 'formula',
  fixedEmiAmount = 0,
  className,
}: LoanEMIPreviewProps): JSX.Element {
  const isReady = principal > 0 && tenureMonths > 0 && interestRate >= 0;
  const isFixedEmi = emiCalculationMode === 'fixed' && fixedEmiAmount > 0;

  const emiBreakdown = useMemo(() => {
    if (!isReady) return null;
    return getLoanComponents({
      principal,
      insuranceAmount: insuranceAmount > 0 ? insuranceAmount : undefined,
      interestRate,
      tenureMonths,
    });
  }, [isReady, principal, insuranceAmount, interestRate, tenureMonths]);

  const formulaEmi = useMemo(() => {
    if (!isReady) return 0;
    if (emiBreakdown && emiBreakdown.length > 1) {
      return Math.round(emiBreakdown.reduce((sum, component) => sum + component.emiAmount, 0));
    }
    return Math.round(calculateEMI(principal, interestRate, tenureMonths));
  }, [isReady, emiBreakdown, principal, interestRate, tenureMonths]);

  const displayEmi = isFixedEmi ? fixedEmiAmount : formulaEmi;

  const actualTenure = useMemo(() => {
    if (!isReady || !isFixedEmi) return null;
    return calculateTenureFromFixedEMI(
      principal,
      insuranceAmount > 0 ? insuranceAmount : undefined,
      interestRate,
      fixedEmiAmount,
      tenureMonths + 120,
    );
  }, [isReady, isFixedEmi, principal, insuranceAmount, interestRate, fixedEmiAmount, tenureMonths]);

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <div className='bg-primary/10 text-primary rounded-lg p-2'>
            <Calculator className='size-4' />
          </div>
          <div>
            <CardTitle className='text-base'>EMI Preview</CardTitle>
            <CardDescription>Updates as you enter loan details</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='bg-muted/50 rounded-lg border p-4 text-center'>
          <p className='text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase'>
            {isFixedEmi ? 'Fixed monthly EMI' : 'Estimated monthly EMI'}
          </p>
          <p className={cn('text-3xl font-bold tracking-tight', !isReady && 'text-muted-foreground')}>
            {isReady ? formatCurrency(displayEmi) : '—'}
          </p>
          {isFixedEmi && isReady && (
            <p className='text-muted-foreground mt-2 text-xs'>
              Formula EMI would be {formatCurrency(formulaEmi)}
              {formulaEmi !== displayEmi && (
                <span>
                  {' '}
                  ({displayEmi > formulaEmi ? '+' : ''}
                  {formatCurrency(displayEmi - formulaEmi)})
                </span>
              )}
            </p>
          )}
          {!isReady && (
            <p className='text-muted-foreground mt-2 text-xs'>Enter amount, rate, and tenure to calculate</p>
          )}
        </div>

        <div className='space-y-3'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground flex items-center gap-2'>
              <IndianRupee className='size-3.5' />
              Principal
            </span>
            <span className='font-medium'>{principal > 0 ? formatCurrency(principal) : '—'}</span>
          </div>
          {insuranceAmount > 0 && (
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground flex items-center gap-2'>
                <Shield className='size-3.5' />
                Insurance
              </span>
              <span className='font-medium'>{formatCurrency(insuranceAmount)}</span>
            </div>
          )}
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground flex items-center gap-2'>
              <Percent className='size-3.5' />
              Interest rate
            </span>
            <span className='font-medium'>{interestRate > 0 || isReady ? `${interestRate}% p.a.` : '—'}</span>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground flex items-center gap-2'>
              <Timer className='size-3.5' />
              {isFixedEmi && actualTenure !== null && actualTenure < tenureMonths ? 'Actual tenure' : 'Tenure'}
            </span>
            <span className='font-medium'>
              {tenureMonths > 0
                ? isFixedEmi && actualTenure !== null && actualTenure < tenureMonths
                  ? `${formatTenure(actualTenure)} (max ${formatTenure(tenureMonths)})`
                  : formatTenure(tenureMonths)
                : '—'}
            </span>
          </div>
        </div>

        {emiBreakdown && emiBreakdown.length > 1 && !isFixedEmi && (
          <>
            <Separator />
            <div className='space-y-2'>
              <p className='text-sm font-medium'>Component breakdown</p>
              <ul className='space-y-1.5 text-sm'>
                {emiBreakdown.map((component) => (
                  <li key={component.label} className='flex justify-between'>
                    <span className='text-muted-foreground'>{component.label}</span>
                    <span className='font-medium'>{formatCurrency(Math.round(component.emiAmount))}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
