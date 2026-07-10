import { getNumberLocale } from '@/lib/locale';

import type { Loan, InterestRoundingMode } from '@/types';

import type { LoanComponentBreakdown } from './types';

export function calculateEMI(principal: number, annualInterestRate: number, tenureMonths: number): number {
  if (tenureMonths === 0) return 0;

  const monthlyRate = annualInterestRate / 100 / 12;
  if (monthlyRate === 0) {
    return principal / tenureMonths;
  }

  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);

  return Math.round(emi * 100) / 100;
}

export function getTotalPrincipal(loan: Pick<Loan, 'principal' | 'insuranceAmount'>): number {
  return loan.principal + (loan.insuranceAmount ?? 0);
}

export function hasInsuranceComponent(loan: Pick<Loan, 'insuranceAmount'>): boolean {
  return (loan.insuranceAmount ?? 0) > 0;
}

export function getLoanComponents(
  loan: Pick<Loan, 'principal' | 'insuranceAmount' | 'interestRate' | 'tenureMonths'>,
): LoanComponentBreakdown[] {
  const components: LoanComponentBreakdown[] = [
    {
      label: 'Principal',
      principal: loan.principal,
      emiAmount: calculateEMI(loan.principal, loan.interestRate, loan.tenureMonths),
    },
  ];

  if (hasInsuranceComponent(loan)) {
    components.push({
      label: 'Insurance',
      principal: loan.insuranceAmount!,
      emiAmount: calculateEMI(loan.insuranceAmount!, loan.interestRate, loan.tenureMonths),
    });
  }

  return components;
}

export function calculateTotalLoanEMI(
  principal: number,
  insuranceAmount: number | undefined,
  annualInterestRate: number,
  tenureMonths: number,
): number {
  const homeEmi = calculateEMI(principal, annualInterestRate, tenureMonths);
  const insuranceEmi =
    insuranceAmount && insuranceAmount > 0 ? calculateEMI(insuranceAmount, annualInterestRate, tenureMonths) : 0;

  return Math.round((homeEmi + insuranceEmi) * 100) / 100;
}

/** First-month interest on the total principal — minimum viable fixed EMI */
export function calculateMinimumFixedEMI(
  principal: number,
  insuranceAmount: number | undefined,
  annualInterestRate: number,
): number {
  const totalPrincipal = principal + (insuranceAmount ?? 0);
  const monthlyRate = annualInterestRate / 100 / 12;
  return Math.round(totalPrincipal * monthlyRate * 100) / 100;
}

/**
 * Estimate how many months it takes to repay at a fixed EMI.
 * Interest is calculated on the reducing balance; principal = EMI − interest.
 */
export function calculateTenureFromFixedEMI(
  principal: number,
  insuranceAmount: number | undefined,
  annualInterestRate: number,
  fixedEmi: number,
  maxMonths: number = 600,
): number {
  const totalPrincipal = principal + (insuranceAmount ?? 0);
  if (totalPrincipal <= 0 || fixedEmi <= 0) return 0;

  const monthlyRate = annualInterestRate / 100 / 12;
  let outstanding = totalPrincipal;
  let months = 0;

  while (outstanding > 0.01 && months < maxMonths) {
    const interest = Math.round(outstanding * monthlyRate * 100) / 100;
    if (fixedEmi <= interest) {
      return maxMonths;
    }
    const principalPayment = Math.min(Math.round((fixedEmi - interest) * 100) / 100, outstanding);
    outstanding = Math.round((outstanding - principalPayment) * 100) / 100;
    months++;
  }

  return months;
}

export function resolveLoanEmiAmount(
  loan: Pick<Loan, 'principal' | 'insuranceAmount' | 'interestRate' | 'tenureMonths' | 'emiCalculationMode'> & {
    emiAmount?: number;
  },
  fixedEmiAmount?: number,
): number {
  if (loan.emiCalculationMode === 'fixed') {
    const amount = fixedEmiAmount ?? loan.emiAmount;
    if (amount !== undefined && amount > 0) {
      return amount;
    }
  }

  return calculateTotalLoanEMI(loan.principal, loan.insuranceAmount, loan.interestRate, loan.tenureMonths);
}

export function applyInterestRounding(amount: number, mode: InterestRoundingMode = 'round'): number {
  switch (mode) {
    case 'floor':
      return Math.floor(amount);
    case 'ceil':
      return Math.ceil(amount);
    case 'round':
    default:
      return Math.round(amount);
  }
}

/** Daily interest using actual/365 (how many banks charge broken-period interest per sub-loan). */
export function calculateActual365Interest(
  principal: number,
  annualInterestRate: number,
  days: number,
  rounding: InterestRoundingMode = 'round',
): number {
  const raw = principal * (annualInterestRate / 100) * (days / 365);
  return applyInterestRounding(raw, rounding);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(getNumberLocale(), {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
