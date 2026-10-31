import { z } from 'zod';
import { SubscriptionStatus } from '@brightloop/shared';

export const createSubscriptionLineSchema = z
  .object({
    productId: z.string().uuid('Invalid product ID'),
    variantId: z.string().uuid('Invalid variant ID').optional().nullable(),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1),
    taxRate: z.number().min(0, 'Tax rate must be non-negative').default(18.0),
  })
  .strict();

export type CreateSubscriptionLineInput = z.infer<typeof createSubscriptionLineSchema>;

export const createSubscriptionSchema = z
  .object({
    customerId: z.string().uuid('Invalid customer ID').optional(),
    planId: z.string().uuid('Invalid plan ID'),
    status: z
      .enum([SubscriptionStatus.DRAFT, SubscriptionStatus.QUOTATION])
      .default(SubscriptionStatus.QUOTATION),
    quoteValidUntil: z.string().datetime().optional().nullable(),
    paymentTermsDays: z.number().int().min(0).default(15),
    notes: z.string().trim().optional().nullable(),
    discountCode: z.string().trim().optional(),
    lines: z
      .array(createSubscriptionLineSchema)
      .min(1, 'At least one subscription line item is required'),
  })
  .strict();

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const transitionSubscriptionSchema = z
  .object({
    action: z.enum(['CONFIRM', 'ACTIVATE', 'PAUSE', 'RESUME', 'CLOSE']),
    notes: z.string().trim().optional(),
  })
  .strict();

export type TransitionSubscriptionInput = z.infer<typeof transitionSubscriptionSchema>;

export const createQuotationTemplateSchema = z
  .object({
    name: z.string().min(1, 'Template name is required').trim(),
    description: z.string().trim().optional(),
    templateLines: z
      .array(createSubscriptionLineSchema)
      .min(1, 'At least one line item is required'),
  })
  .strict();

export type CreateQuotationTemplateInput = z.infer<typeof createQuotationTemplateSchema>;
