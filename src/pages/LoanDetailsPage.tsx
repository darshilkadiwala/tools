import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLoanContext } from "@/contexts/LoanContext";
import { EMISchedule } from "@/components/emi/EMISchedule";
import { PrePaymentDialog } from "@/components/payment/PrePaymentDialog";
import { StepUpDialog } from "@/components/payment/StepUpDialog";
import { InterestRateModifier } from "@/components/InterestRate/InterestRateModifier";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useEMISchedule } from "@/hooks/useEMISchedule";
import {
  Download,
  Plus,
  Wallet,
  TrendingUp,
  Calendar,
  Percent,
  Edit,
  PencilIcon,
  RefreshCwIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/calculations";

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

  const maxEMINumber =
    schedule.length > 0 ? schedule[schedule.length - 1].emiNumber : 0;

  // Calculate loan statistics
  const totalOutstanding =
    schedule.length > 0
      ? schedule[schedule.length - 1].outstandingPrincipal
      : loan?.principal || 0;
  const totalInterest = schedule.reduce((sum, emi) => sum + emi.interest, 0);

  useEffect(() => {
    if (!loans.loading && !loan) {
      navigate("/");
    }
  }, [loans.loading, loan, navigate]);

  if (loans.loading || !loan || !id) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            {loan.name}
          </h1>
          <p className="text-muted-foreground text-sm uppercase">
            {loan.type} Loan
          </p>
        </div>
        <div className="hidden md:flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => regenerateScheduleRef.current?.()}
            disabled={!regenerateScheduleRef.current}>
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          <Button
            variant="outline"
            onClick={() => exportCSVRef.current?.()}
            disabled={!exportCSVRef.current}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => navigate(`/loans/${id}/edit`)}>
            <PencilIcon className="h-4 w-4 mr-2" />
            Edit Loan
          </Button>
        </div>
      </div>

      {/* My Balances Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Wallet className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <CardDescription className="text-xs">
                  Principal Amount
                </CardDescription>
              </div>
              <CardTitle className="text-2xl font-bold">
                {formatCurrency(loan.principal)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <CardDescription className="text-xs">
                  Outstanding
                </CardDescription>
              </div>
              <CardTitle className="text-2xl font-bold">
                {formatCurrency(totalOutstanding)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Percent className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <CardDescription className="text-xs">
                  EMI Amount
                </CardDescription>
              </div>
              <CardTitle className="text-2xl font-bold">
                {formatCurrency(loan.emiAmount)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-lg">
                  <Calendar className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <CardDescription className="text-xs">
                  Total Interest
                </CardDescription>
              </div>
              <CardTitle className="text-2xl font-bold">
                {formatCurrency(totalInterest)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Transactions</h2>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => exportCSVRef.current?.()}
            disabled={!canExport}>
            <Download className="h-4 w-4 mr-2" />
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
