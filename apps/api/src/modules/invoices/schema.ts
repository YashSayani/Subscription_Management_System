import { z } from 'zod';
import { InvoiceStatus } from '@brightloop/shared';

export const listInvoicesQuerySchema = z
  .object({
    status: z.nativeEnum(InvoiceStatus).optional(),
    isOverdue: z
      .union([z.boolean(), z.string().transform((val) => val === 'true')])
      .optional(),
    customerId: z.string().uuid().optional(),
    subscriptionId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

export const cancelInvoiceSchema = z
  .object({
    reason: z.string().trim().optional(),
  })
  .strict();

export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
