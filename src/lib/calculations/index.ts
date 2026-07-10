// Types
export type {
  AdjustmentAmounts,
  AdjustmentComponentBreakdown,
  AdjustmentPreview,
  InterestVarianceAnalysis,
  InterestVarianceExplanation,
  LoanComponentBreakdown,
} from './types';

// EMI formula
export {
  applyInterestRounding,
  calculateActual365Interest,
  calculateEMI,
  calculateMinimumFixedEMI,
  calculateTenureFromFixedEMI,
  calculateTotalLoanEMI,
  formatCurrency,
  getLoanComponents,
  getTotalPrincipal,
  hasInsuranceComponent,
  resolveLoanEmiAmount,
} from './emi-formula';

// Moratorium
export {
  calculateMoratoriumMonthInterest,
  calculateSimpleMoratoriumMonthInterest,
  getEffectiveMoratoriumRate,
  getMoratoriumMonthCount,
  hasMoratoriumPeriod,
  resolveEmiPostingOrder,
  resolveInterestAccrualMethod,
  resolveMoratoriumInterestMode,
} from './moratorium';

// Adjustments
export {
  calculateAdjustmentPreview,
  explainInterestVariance,
  isShortPartialPeriodGap,
  needsAdjustmentPayment,
} from './adjustments';

// Schedule
export { generateEMISchedule, getCurrentOutstanding, getEMIStatus } from './schedule';

// Modifications
export { applyStepUp, recalculateAfterPrepayment, recalculateInterestRate } from './modifications';
