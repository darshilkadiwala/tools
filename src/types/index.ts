export type LoanType = 'home' | 'car' | 'education' | 'personal' | 'other'

export type EMIStatus = 'pending' | 'paid' | 'modified' | 'upcoming'

export type ModificationType = 'prepayment' | 'stepup' | 'interest_change'

export interface Loan {
  id: string
  name: string
  type: LoanType
  principal: number
  interestRate: number // Annual percentage
  tenureMonths: number
  startDate: string // Loan start date (ISO UTC string)
  emiStartDate?: string // First EMI due date (ISO UTC string, optional for backward compatibility)
  emiAmount: number // Calculated EMI
  createdAt: string // ISO UTC string
  updatedAt: string // ISO UTC string
}

export interface EMIScheduleEntry {
  id: string
  loanId: string
  emiNumber: number
  dueDate: string // ISO UTC string
  principal: number
  interest: number
  total: number
  outstandingPrincipal: number
  status: EMIStatus
  modifiedInterestRate?: number // If rate changed for this EMI
  isAdjustment?: boolean // True if this is an adjustment payment (partial first month)
}

export interface LoanModification {
  id: string
  loanId: string
  type: ModificationType
  date: string // ISO UTC string
  amount?: number // For prepayment/stepup
  percentage?: number // For stepup percentage
  newInterestRate?: number // For interest change
  affectedEMIs: number[] // EMI numbers affected
}

