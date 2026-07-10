export type LoanType = 'home' | 'car' | 'education' | 'personal' | 'other';

export type EMIStatus = 'pending' | 'paid' | 'modified' | 'upcoming';

/** Kind of row in the EMI schedule ledger */
export type ScheduleEntryKind = 'emi' | 'adjustment' | 'moratorium' | 'disbursement';

export type ModificationType = 'prepayment' | 'stepup' | 'interest_change';

/** How to handle the partial period between loan disbursement and first EMI */
export type AdjustmentType = 'proportional' | 'interest_only' | 'none' | 'custom';

/** How to round broken-period interest amounts to whole rupees */
export type InterestRoundingMode = 'round' | 'floor' | 'ceil';

/** Whether EMI is derived from the standard formula or set to a bank-stated fixed amount */
export type EmiCalculationMode = 'formula' | 'fixed';

/** How monthly interest is calculated during moratorium and repayment */
export type InterestAccrualMethod = 'monthly_reducing' | 'actual_365';

/** How the bank applies EMI vs interest within each repayment cycle */
export type EmiPostingOrder = 'standard' | 'emi_first';

/**
 * How moratorium interest is accrued before regular EMIs begin.
 * SBI charges simple interest on each disbursed tranche (not on capitalized interest).
 */
export type MoratoriumInterestMode = 'simple_on_disbursements' | 'compound_on_outstanding';

export interface LoanDisbursement {
  date: string;
  amount: number;
  label?: string;
}

/** Interest rate change during the study/moratorium period (before regular EMIs begin) */
export interface MoratoriumRateChange {
  date: string;
  newInterestRate: number;
}

export interface Loan {
  id: string;
  name: string;
  type: LoanType;
  principal: number;
  interestRate: number; // Annual percentage
  tenureMonths: number;
  startDate: string; // Loan start date (ISO UTC string)
  emiStartDate?: string; // First EMI due date (ISO UTC string, optional for backward compatibility)
  adjustmentType?: AdjustmentType; // How to handle partial period before first EMI
  customAdjustmentPrincipal?: number; // Used when adjustmentType is 'custom'
  customAdjustmentInterest?: number; // Used when adjustmentType is 'custom'
  /** Insurance premium financed as a separate sub-loan (home loans). Combined with principal for total outstanding. */
  insuranceAmount?: number;
  /** How each sub-loan's broken-period interest is rounded to whole rupees (default: round) */
  interestRounding?: InterestRoundingMode;
  /** How the monthly EMI is determined (default: formula) */
  emiCalculationMode?: EmiCalculationMode;
  /** Original amount disbursed (before moratorium interest capitalization). Used to simulate study-period accrual. */
  disbursedPrincipal?: number;
  /** Tranche disbursements during study period (optional detail for education loans) */
  disbursements?: LoanDisbursement[];
  /** Interest rate changes during the moratorium period (before first EMI) */
  moratoriumRateChanges?: MoratoriumRateChange[];
  /** Interest calculation method (default: actual_365 for education loans with moratorium) */
  interestAccrualMethod?: InterestAccrualMethod;
  /** Whether EMI is credited before month-end interest is charged (SBI-style ledger) */
  emiPostingOrder?: EmiPostingOrder;
  /** Moratorium interest base — SBI uses simple interest on disbursed tranches only */
  moratoriumInterestMode?: MoratoriumInterestMode;
  emiAmount: number; // Total monthly EMI (formula-derived or user-fixed)
  createdAt: string; // ISO UTC string
  updatedAt: string; // ISO UTC string
}

export interface EMIScheduleEntry {
  id: string;
  loanId: string;
  /** Sequence within the entry kind (EMI 1, 2…; Moratorium 1, 2…; etc.) */
  emiNumber: number;
  /** Row type — source of truth for moratorium, disbursement, adjustment vs regular EMI */
  entryKind?: ScheduleEntryKind;
  dueDate: string; // ISO UTC string
  principal: number;
  interest: number;
  total: number;
  outstandingPrincipal: number;
  status: EMIStatus;
  modifiedInterestRate?: number; // Effective annual rate applied to this entry
  isAdjustment?: boolean; // True if this is an adjustment payment (partial first month)
  /** True for interest-only study/moratorium period entries before regular EMIs begin */
  isMoratorium?: boolean;
  /** True for tranche disbursement credit rows during moratorium */
  isDisbursement?: boolean;
  /** Label for disbursement tranche (e.g. university name) */
  disbursementLabel?: string;
  /** Per-component breakdown for split loans (e.g. home + insurance) on adjustment rows */
  adjustmentComponents?: Array<{ label: string; interest: number; principal: number }>;
}

export interface LoanModification {
  id: string;
  loanId: string;
  type: ModificationType;
  date: string; // ISO UTC string
  amount?: number; // For prepayment/stepup
  percentage?: number; // For stepup percentage
  newInterestRate?: number; // For interest change
  affectedEMIs: number[]; // EMI numbers affected
}
