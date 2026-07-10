import { useEffect, useMemo, useState, type JSX } from 'react';

import { Calendar, PencilIcon, Percent, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { EMISchedule } from '@/components/emi/EMISchedule';
import { InterestRateModifier } from '@/components/interest-rate/InterestRateModifier';
import { DeleteLoanDialog } from '@/components/loan/DeleteLoanDialog';
import { PrePaymentDialog } from '@/components/modifications/PrePaymentDialog';
import { StepUpDialog } from '@/components/modifications/StepUpDialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineError } from '@/components/ui/inline-error';
import { PageLoader } from '@/components/ui/page-loader';
import { EMIScheduleProvider, useEMISchedule } from '@/contexts/EMIScheduleContext';
import { useLoanContext } from '@/contexts/LoanContext';
import { formatCurrency, getCurrentOutstanding, getLoanComponents, getTotalPrincipal } from '@/lib/calculations';
import { getMaxRegularEmiNumber, isRegularEmiEntry } from '@/lib/schedule-entry';
import type { ScheduleRateContext } from '@/lib/schedule-rate';

function LoanDetailsContent({ loanId }: { loanId: string }): JSX.Element {
  const navigate = useNavigate();
  const { loans } = useLoanContext();
  const { schedule, loading, error } = useEMISchedule();

  const [showPrepayment, setShowPrepayment] = useState(false);
  const [showStepUp, setShowStepUp] = useState(false);
  const [showInterestChange, setShowInterestChange] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  const loan = loans.loans.find((item) => item.id === loanId);
  const maxEMINumber = getMaxRegularEmiNumber(schedule);
  const rateContext = useMemo<ScheduleRateContext | undefined>(
    () =>
      loan
        ? {
            baseInterestRate: loan.interestRate,
            moratoriumRateChanges: loan.moratoriumRateChanges,
          }
        : undefined,
    [loan],
  );

  useEffect(() => {
    if (!loans.loading && !loan) {
      void navigate('/');
    }
  }, [loans.loading, loan, navigate]);

  if (loans.loading || !loan) {
    return <PageLoader />;
  }

  if (loading) {
    return <PageLoader message='Loading EMI schedule...' />;
  }

  if (error) {
    return <InlineError message={error.message} />;
  }

  const selectedEMIs = schedule
    .filter((emi) => selectedEntryIds.includes(emi.id) && isRegularEmiEntry(emi))
    .map((emi) => emi.emiNumber);

  const totalLoanPrincipal = getTotalPrincipal(loan);
  const loanComponents = getLoanComponents(loan);
  const hasInsurance = (loan.insuranceAmount ?? 0) > 0;
  const totalOutstanding = getCurrentOutstanding(schedule, totalLoanPrincipal);
  const totalInterest = schedule.reduce((sum, emi) => sum + emi.interest, 0);

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='mb-2 text-3xl font-semibold tracking-tight'>{loan.name}</h1>
          <p className='text-muted-foreground text-sm uppercase'>{loan.type} Loan</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button
            className='hidden md:inline-flex'
            onClick={() => {
              void navigate(`/loans/${loanId}/edit`);
            }}>
            <PencilIcon className='mr-2 h-4 w-4' />
            Edit Loan
          </Button>
          <Button variant='destructive-outline' size='sm' onClick={() => setShowDelete(true)}>
            <Trash2 className='size-4' />
            <span className='hidden sm:inline'>Delete</span>
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader>
            <div className='mb-2 flex items-center gap-2'>
              <div className='rounded-lg bg-orange-100 p-2 dark:bg-orange-900/20'>
                <Wallet className='size-5 text-orange-600 dark:text-orange-400' />
              </div>
              <CardDescription className='text-xs'>Principal Amount</CardDescription>
            </div>
            <CardTitle className='text-2xl font-bold'>{formatCurrency(totalLoanPrincipal)}</CardTitle>
            {hasInsurance && (
              <CardDescription className='text-xs'>
                Principal {formatCurrency(loan.principal)} + Insurance {formatCurrency(loan.insuranceAmount ?? 0)}
              </CardDescription>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className='mb-2 flex items-center gap-2'>
              <div className='rounded-lg bg-purple-100 p-2 dark:bg-purple-900/20'>
                <TrendingUp className='size-5 text-purple-600 dark:text-purple-400' />
              </div>
              <CardDescription className='text-xs'>Outstanding</CardDescription>
            </div>
            <CardTitle className='text-2xl font-bold'>{formatCurrency(totalOutstanding)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className='mb-2 flex items-center gap-2'>
              <div className='rounded-lg bg-blue-100 p-2 dark:bg-blue-900/20'>
                <Percent className='size-5 text-blue-600 dark:text-blue-400' />
              </div>
              <CardDescription className='text-xs'>EMI Amount</CardDescription>
            </div>
            <CardTitle className='text-2xl font-bold'>{formatCurrency(loan.emiAmount)}</CardTitle>
            {loan.emiCalculationMode === 'fixed' && (
              <CardDescription className='text-xs'>Fixed bank-stated EMI</CardDescription>
            )}
            {hasInsurance && (
              <CardDescription className='text-xs'>
                Principal {formatCurrency(Math.round(loanComponents[0].emiAmount))} + Insurance{' '}
                {formatCurrency(Math.round(loanComponents[1]?.emiAmount ?? 0))}
              </CardDescription>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className='mb-2 flex items-center gap-2'>
              <div className='rounded-lg bg-teal-100 p-2 dark:bg-teal-900/20'>
                <Calendar className='size-5 text-teal-600 dark:text-teal-400' />
              </div>
              <CardDescription className='text-xs'>Total Interest</CardDescription>
            </div>
            <CardTitle className='text-2xl font-bold'>{formatCurrency(totalInterest)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <EMISchedule
        loanId={loan.id}
        rateContext={rateContext}
        onPrepayment={() => setShowPrepayment(true)}
        onStepUp={() => setShowStepUp(true)}
        onInterestChange={() => setShowInterestChange(true)}
        onSelectedEntryIdsChange={setSelectedEntryIds}
        selectedEntryIds={selectedEntryIds}
      />

      <PrePaymentDialog
        open={showPrepayment}
        onOpenChange={setShowPrepayment}
        loanId={loan.id}
        maxEMINumber={maxEMINumber}
        onSuccess={() => setShowPrepayment(false)}
      />

      <StepUpDialog
        open={showStepUp}
        onOpenChange={setShowStepUp}
        loanId={loan.id}
        maxEMINumber={maxEMINumber}
        onSuccess={() => setShowStepUp(false)}
      />

      <InterestRateModifier
        open={showInterestChange}
        onOpenChange={setShowInterestChange}
        loanId={loan.id}
        currentRate={loan.interestRate}
        selectedEMIs={selectedEMIs}
        onSuccess={() => {
          setShowInterestChange(false);
          setSelectedEntryIds([]);
        }}
      />

      <DeleteLoanDialog
        loan={loan}
        open={showDelete}
        onOpenChange={setShowDelete}
        onDeleted={() => {
          void navigate('/');
        }}
      />
    </div>
  );
}

export function LoanDetailsPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <InlineError message='Loan not found' />;
  }

  return (
    <EMIScheduleProvider loanId={id}>
      <LoanDetailsContent loanId={id} />
    </EMIScheduleProvider>
  );
}
