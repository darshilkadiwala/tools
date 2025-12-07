import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoanContext } from "@/contexts/LoanContext";
import { LoanForm } from "@/components/loan/LoanForm";
import type { Loan } from "@/types";
import { Separator } from "@/components/ui/separator";

export function CreateLoanPage() {
  const { loans } = useLoanContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleCreateLoan = async (
    data: Omit<Loan, "id" | "createdAt" | "updatedAt" | "emiAmount">
  ) => {
    try {
      setError(null);
      await loans.createLoan(data);
      navigate("/");
    } catch (error) {
      console.error("Failed to create loan:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create loan"
      );
    }
  };

  return (
    <>
      {error && (
        <div className="p-4 mb-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <h1 className="text-3xl mb-2 font-bold tracking-tight">
        Create New Loan
      </h1>
      <p className="text-muted-foreground text-base">
        Fill in the details below to create a new loan account
      </p>
      <Separator className="my-4" />

      <LoanForm onSubmit={handleCreateLoan} onCancel={() => navigate("/")} />
    </>
  );
}
