import { useState, useMemo, useEffect, useCallback } from "react";
import { EMITable } from "./EMITable";
import { UpdateEMIDateDialog } from "./UpdateEMIDateDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEMISchedule } from "@/hooks/useEMISchedule";
import { Calendar, CalendarDays } from "lucide-react";
import { getYear } from "date-fns";
import { isoToDate } from "@/lib/utils";

interface EMIScheduleProps {
  loanId: string;
  onPrepayment?: () => void;
  onStepUp?: () => void;
  onInterestChange?: () => void;
  onSelectedEMIsChange?: (emiNumbers: number[]) => void;
  selectedEMIs?: number[];
  onRegenerateReady?: (regenerateFn: () => Promise<void>) => void;
  onExportReady?: (exportFn: () => void) => void;
}

export function EMISchedule({
  loanId,
  onPrepayment,
  onStepUp,
  onInterestChange,
  onSelectedEMIsChange,
  selectedEMIs: externalSelectedEMIs,
  onRegenerateReady,
  onExportReady,
}: EMIScheduleProps) {
  const { schedule, loading, error, regenerateSchedule } =
    useEMISchedule(loanId);
  const [internalSelectedEMIs, setInternalSelectedEMIs] = useState<number[]>(
    []
  );
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [showUpdateEMIDate, setShowUpdateEMIDate] = useState(false);

  const selectedEMIs =
    externalSelectedEMIs !== undefined
      ? externalSelectedEMIs
      : internalSelectedEMIs;

  // Get all available years from the schedule
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    schedule.forEach((emi) => {
      years.add(getYear(isoToDate(emi.dueDate)));
    });
    return Array.from(years).sort((a, b) => a - b); // Sort ascending (oldest first)
  }, [schedule]);

  // Filter schedule by selected year and sort by EMI number in descending order
  const filteredSchedule = useMemo(() => {
    return schedule
      .filter((emi) => getYear(isoToDate(emi.dueDate)) === selectedYear)
      .sort((a, b) => {
        // Sort by EMI number in descending order (highest first)
        return b.emiNumber - a.emiNumber;
      });
  }, [schedule, selectedYear]);

  // Update selected year to current year if it's not in available years
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      // If current year is available, use it, otherwise use the most recent year (last in ascending order)
      const yearToUse = availableYears.includes(currentYear)
        ? currentYear
        : availableYears[availableYears.length - 1];
      setSelectedYear(yearToUse);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableYears]);

  const handleSelectedEMIsChange = (emiNumbers: number[]) => {
    if (onSelectedEMIsChange) {
      onSelectedEMIsChange(emiNumbers);
    } else {
      setInternalSelectedEMIs(emiNumbers);
    }
  };

  const exportToCSV = useCallback(() => {
    if (filteredSchedule.length === 0) return;

    const headers = [
      "EMI #",
      "Due Date",
      "Principal",
      "Interest",
      "Total",
      "Outstanding Principal",
      "Status",
    ];
    const rows = filteredSchedule.map((emi) => [
      emi.isAdjustment ? "Adjustment" : emi.emiNumber,
      isoToDate(emi.dueDate).toISOString().split("T")[0],
      emi.principal,
      emi.interest,
      emi.total,
      emi.outstandingPrincipal,
      emi.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emi-schedule-${loanId}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredSchedule, loanId, selectedYear]);

  // Expose functions to parent component
  useEffect(() => {
    if (onRegenerateReady) {
      onRegenerateReady(async () => {
        await regenerateSchedule();
      });
    }
  }, [onRegenerateReady, regenerateSchedule]);

  useEffect(() => {
    if (onExportReady) {
      onExportReady(exportToCSV);
    }
  }, [onExportReady, exportToCSV]);


  if (loading) {
    return <div className="text-center py-8">Loading EMI schedule...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {onPrepayment && (
            <Button onClick={onPrepayment} variant="outline">
              Pre-payment
            </Button>
          )}
          {onStepUp && (
            <Button onClick={onStepUp} variant="outline">
              Step-up EMI
            </Button>
          )}
          {onInterestChange && (
            <Button onClick={onInterestChange} variant="outline">
              Change Interest Rate
            </Button>
          )}
          <Button onClick={() => setShowUpdateEMIDate(true)} variant="outline">
            <CalendarDays className="h-4 w-4 mr-2" />
            Update EMI Dates
          </Button>
          {selectedEMIs.length > 0 && (
            <span className="text-sm text-muted-foreground self-center">
              {selectedEMIs.length} EMI(s) selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Filter by Year:
          </Label>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <EMITable
        schedule={filteredSchedule}
        onSelectEMI={handleSelectedEMIsChange}
        selectedEMIs={selectedEMIs}
        showActions={!!onInterestChange}
      />

      <UpdateEMIDateDialog
        open={showUpdateEMIDate}
        onOpenChange={setShowUpdateEMIDate}
        loanId={loanId}
        maxEMINumber={
          schedule.length > 0 ? schedule[schedule.length - 1].emiNumber : 0
        }
        onSuccess={() => {
          setShowUpdateEMIDate(false);
        }}
      />
    </div>
  );
}
