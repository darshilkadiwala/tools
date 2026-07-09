export type LoanType = 'home' | 'car' | 'education' | 'personal' | 'other';

export type EMIStatus = 'pending' | 'paid' | 'modified' | 'upcoming';

export type ModificationType = 'prepayment' | 'stepup' | 'interest_change';

/** How to handle the partial period between loan disbursement and first EMI */
export type AdjustmentType = 'proportional' | 'interest_only' | 'none' | 'custom';

/** How to round broken-period interest amounts to whole rupees */
export type InterestRoundingMode = 'round' | 'floor' | 'ceil';

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
  emiAmount: number; // Calculated total EMI (home + insurance when applicable)
  createdAt: string; // ISO UTC string
  updatedAt: string; // ISO UTC string
}

export interface EMIScheduleEntry {
  id: string;
  loanId: string;
  emiNumber: number;
  dueDate: string; // ISO UTC string
  principal: number;
  interest: number;
  total: number;
  outstandingPrincipal: number;
  status: EMIStatus;
  modifiedInterestRate?: number; // If rate changed for this EMI
  isAdjustment?: boolean; // True if this is an adjustment payment (partial first month)
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
