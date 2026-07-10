import { z } from 'zod';

export const interestRateSchema = z.object({
  newInterestRate: z.number().min(0, 'Interest rate must be non-negative').max(100, 'Interest rate cannot exceed 100%'),
  applyTo: z.enum(['all', 'selected']),
  selectedEMIs: z.array(z.number()).optional(),
});

export type InterestRateFormValues = z.infer<typeof interestRateSchema>;
