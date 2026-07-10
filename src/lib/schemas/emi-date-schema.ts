import { z } from 'zod';

export const updateEMIDateSchema = z
  .object({
    startEMINumber: z.number().min(1, 'Start EMI number must be at least 1'),
    endEMINumber: z.number().min(1, 'End EMI number must be at least 1'),
    newStartDate: z.string().min(1, 'New start date is required'),
  })
  .refine((data) => data.endEMINumber >= data.startEMINumber, {
    message: 'End EMI number must be greater than or equal to start EMI number',
    path: ['endEMINumber'],
  });

export type UpdateEMIDateFormValues = z.infer<typeof updateEMIDateSchema>;
