import { z } from 'zod';
import { PaymentMethod } from '@brightloop/shared';

export const recordPaymentSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  amount: z.union([z.number(), z.string()]).refine((val) => Number(val) > 0, {
    message: 'Payment amount must be greater than zero',
  }),
  paymentDate: z.string().optional(),
  method: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  notes: z.string().max(500).optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid('Invalid invoice ID'),
        amount: z.union([z.number(), z.string()]).refine((val) => Number(val) > 0, {
          message: 'Allocation amount must be greater than zero',
        }),
      }),
    )
    .optional(),
});

export const applyCreditSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  amount: z.union([z.number(), z.string()]).refine((val) => Number(val) > 0, {
    message: 'Credit allocation amount must be greater than zero',
  }),
});

export const listPaymentsQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ApplyCreditInput = z.infer<typeof applyCreditSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
