import { useEffect, useRef, useState } from 'react';

import { Calendar, Download, PencilIcon, Percent, RefreshCwIcon, TrendingUp, Wallet } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { EMISchedule } from '@/components/emi/EMISchedule';
import { InterestRateModifier } from '@/components/InterestRate/InterestRateModifier';
import { PrePaymentDialog } from '@/components/payment/PrePaymentDialog';
import { StepUpDialog } from '@/components/payment/StepUpDialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLoanContext } from '@/contexts/LoanContext';
import { useEMISchedule } from '@/hooks/useEMISchedule';
import { formatCurrency } from '@/lib/calculations';

export function LoanDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loans } = useLoanContext();

  const [showPrepayment, setShowPrepayment] = useState(false);
  const [showStepUp, setShowStepUp] = useState(false);
  const [showInterestChange, setShowInterestChange] = useState(false);
  const [selectedEMIs, setSelectedEMIs] = useState<number[]>([]);
  const [canExport, setCanExport] = useState(false);
  const regenerateScheduleRef = useRef<(() => Promise<void>) | null>(null);
  const exportCSVRef = useRef<(() => void) | null>(null);

  const loan = loans.loans.find((l) => l.id === id);
  const { schedule } = useEMISchedule(id || null);

  const maxEMINumber = schedule.length > 0 ? schedule[schedule.length - 1].emiNumber : 0;

  // Calculate loan statistics
  const totalOutstanding =
    schedule.length > 0 ? schedule[schedule.length - 1].outstandingPrincipal : loan?.principal || 0;
  const totalInterest = schedule.reduce((sum, emi) => sum + emi.interest, 0);

  useEffect(() => {
    if (!loans.loading && !loan) {
      navigate('/');
    }
  }, [loans.loading, loan, navigate]);

  if (loans.loading || !loan || !id) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center'>
          <div className='border-primary mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-8'>
      {/* Dashboard Header */}
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='mb-2 text-3xl font-semibold tracking-tight'>{loan.name}</h1>
          <p className='text-muted-foreground text-sm uppercase'>{loan.type} Loan</p>
        </div>
        <div className='hidden items-center justify-between gap-2 md:flex'>
          <Button
            variant='outline'
            onClick={() => regenerateScheduleRef.current?.()}
            disabled={!regenerateScheduleRef.current}>
            <RefreshCwIcon className='mr-2 h-4 w-4' />
            Regenerate
          </Button>
          <Button variant='outline' onClick={() => exportCSVRef.current?.()} disabled={!exportCSVRef.current}>
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
          <Button onClick={() => navigate(`/loans/${id}/edit`)}>
            <PencilIcon className='mr-2 h-4 w-4' />
            Edit Loan
          </Button>
        </div>
      </div>

      {/* My Balances Section */}
      <div className='space-y-4'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <Card className='border-2'>
            <CardHeader className='pb-3'>
              <div className='mb-2 flex items-center gap-2'>
                <div className='rounded-lg bg-orange-100 p-2 dark:bg-orange-900/20'>
                  <Wallet className='h-5 w-5 text-orange-600 dark:text-orange-400' />
                </div>
                <CardDescription className='text-xs'>Principal Amount</CardDescription>
              </div>
              <CardTitle className='text-2xl font-bold'>{formatCurrency(loan.principal)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className='border-2'>
            <CardHeader className='pb-3'>
              <div className='mb-2 flex items-center gap-2'>
                <div className='rounded-lg bg-purple-100 p-2 dark:bg-purple-900/20'>
                  <TrendingUp className='h-5 w-5 text-purple-600 dark:text-purple-400' />
                </div>
                <CardDescription className='text-xs'>Outstanding</CardDescription>
              </div>
              <CardTitle className='text-2xl font-bold'>{formatCurrency(totalOutstanding)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className='border-2'>
            <CardHeader className='pb-3'>
              <div className='mb-2 flex items-center gap-2'>
                <div className='rounded-lg bg-blue-100 p-2 dark:bg-blue-900/20'>
                  <Percent className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                </div>
                <CardDescription className='text-xs'>EMI Amount</CardDescription>
              </div>
              <CardTitle className='text-2xl font-bold'>{formatCurrency(loan.emiAmount)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className='border-2'>
            <CardHeader className='pb-3'>
              <div className='mb-2 flex items-center gap-2'>
                <div className='rounded-lg bg-teal-100 p-2 dark:bg-teal-900/20'>
                  <Calendar className='h-5 w-5 text-teal-600 dark:text-teal-400' />
                </div>
                <CardDescription className='text-xs'>Total Interest</CardDescription>
              </div>
              <CardTitle className='text-2xl font-bold'>{formatCurrency(totalInterest)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Transactions Section */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-xl font-semibold'>Transactions</h2>
          <Button
            variant='outline'
            size='sm'
            className='h-9'
            onClick={() => exportCSVRef.current?.()}
            disabled={!canExport}>
            <Download className='mr-2 h-4 w-4' />
            Export
          </Button>
        </div>

        <EMISchedule
          loanId={loan.id}
          onPrepayment={() => setShowPrepayment(true)}
          onStepUp={() => setShowStepUp(true)}
          onInterestChange={() => setShowInterestChange(true)}
          onSelectedEMIsChange={setSelectedEMIs}
          selectedEMIs={selectedEMIs}
          onRegenerateReady={(fn) => {
            regenerateScheduleRef.current = fn;
          }}
          onExportReady={(fn) => {
            exportCSVRef.current = fn;
            setCanExport(!!fn);
          }}
        />
      </div>

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
          setSelectedEMIs([]);
        }}
      />
    </div>
  );
}
