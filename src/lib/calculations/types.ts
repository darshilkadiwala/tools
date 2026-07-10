export interface AdjustmentAmounts {
  principal: number;
  interest: number;
  total: number;
}

export interface LoanComponentBreakdown {
  label: string;
  principal: number;
  emiAmount: number;
}

export interface AdjustmentComponentBreakdown {
  label: string;
  principal: number;
  interest: number;
}

export interface AdjustmentPreview extends AdjustmentAmounts {
  needsAdjustment: boolean;
  daysFromStart: number;
  daysInMonth: number;
  partialDaysRatio: number;
  proportional: AdjustmentAmounts;
  interestOnly: AdjustmentAmounts;
  /** Per sub-loan interest when home + insurance are financed separately */
  splitInterestOnly?: {
    components: AdjustmentComponentBreakdown[];
    total: AdjustmentAmounts;
  };
}

export interface InterestVarianceExplanation {
  title: string;
  detail: string;
}

export interface InterestVarianceAnalysis {
  calculatedInterest: number;
  bankInterest: number;
  difference: number;
  calculatedPrincipal?: number;
  bankPrincipal?: number;
  principalDifference?: number;
  calculatedTotal?: number;
  bankTotal?: number;
  totalDifference?: number;
  explanations: InterestVarianceExplanation[];
}
