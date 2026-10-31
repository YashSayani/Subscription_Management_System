import { z } from 'zod';
import { DiscountType } from '@brightloop/shared';

export const createDiscountSchema = z.object({
  code: z
    .string()
    .min(3, 'Discount code must be at least 3 characters')
    .max(30, 'Discount code must be at most 30 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must contain alphanumeric characters, underscores or hyphens only')
    .transform((v) => v.toUpperCase().trim()),
  name: z.string().min(2, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(DiscountType, {
    errorMap: () => ({ message: 'Discount type must be PERCENTAGE or FIXED_AMOUNT' }),
  }),
  value: z.union([z.number(), z.string()]).refine((val) => Number(val) > 0, {
    message: 'Discount value must be greater than zero',
  }),
  minPurchaseAmount: z
    .union([z.number(), z.string()])
    .optional()
    .refine((val) => val === undefined || Number(val) >= 0, {
      message: 'Minimum purchase amount cannot be negative',
    }),
  minQuantity: z.number().int().min(1).optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateDiscountSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  value: z
    .union([z.number(), z.string()])
    .optional()
    .refine((val) => val === undefined || Number(val) > 0, {
      message: 'Discount value must be greater than zero',
    }),
  minPurchaseAmount: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .refine((val) => val === undefined || val === null || Number(val) >= 0, {
      message: 'Minimum purchase amount cannot be negative',
    }),
  minQuantity: z.number().int().min(1).optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const validateDiscountSchema = z.object({
  code: z
    .string()
    .min(1, 'Discount code is required')
    .transform((v) => v.toUpperCase().trim()),
  subtotal: z.union([z.number(), z.string()]).refine((val) => Number(val) >= 0, {
    message: 'Subtotal must be non-negative',
  }),
});

export const listDiscountsQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional(),
  type: z.nativeEnum(DiscountType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;
export type ValidateDiscountInput = z.infer<typeof validateDiscountSchema>;
export type ListDiscountsQuery = z.infer<typeof listDiscountsQuerySchema>;
