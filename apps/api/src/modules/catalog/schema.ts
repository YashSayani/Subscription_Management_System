import { z } from 'zod';
import { BillingFrequency } from '@brightloop/shared';

// Money input can be passed as number or string (e.g. 1500 or "1500.00")
const moneyInput = z
  .union([
    z.number().nonnegative('Price must be greater than or equal to 0'),
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount')
      .transform((val) => Number(val)),
  ]);

const priceAdjustmentInput = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount')
      .transform((val) => Number(val)),
  ]);

export const createVariantSchema = z
  .object({
    attributeName: z.string().min(1, 'Attribute name is required').trim(),
    attributeValue: z.string().min(1, 'Attribute value is required').trim(),
    priceAdjustment: priceAdjustmentInput.default(0),
    isAvailable: z.boolean().default(true),
  })
  .strict();

export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = z
  .object({
    attributeName: z.string().min(1).trim().optional(),
    attributeValue: z.string().min(1).trim().optional(),
    priceAdjustment: priceAdjustmentInput.optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict();

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const createProductSchema = z
  .object({
    name: z.string().min(1, 'Product name is required').trim(),
    description: z.string().trim().optional(),
    type: z.enum(['SERVICE', 'PHYSICAL']).default('SERVICE'),
    salesPrice: moneyInput,
    costPrice: moneyInput.default(0),
    notes: z.string().trim().optional(),
    isAvailable: z.boolean().default(true),
    variants: z.array(createVariantSchema).optional(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: z.string().min(1).trim().optional(),
    description: z.string().trim().optional().nullable(),
    type: z.enum(['SERVICE', 'PHYSICAL']).optional(),
    salesPrice: moneyInput.optional(),
    costPrice: moneyInput.optional(),
    notes: z.string().trim().optional().nullable(),
    isAvailable: z.boolean().optional(),
  })
  .strict();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createPlanSchema = z
  .object({
    name: z.string().min(1, 'Plan name is required').trim(),
    description: z.string().trim().optional(),
    billingFrequency: z.nativeEnum(BillingFrequency),
    minQuantity: z.number().int().min(1).default(1),
    availableFrom: z.string().datetime().optional().nullable(),
    availableUntil: z.string().datetime().optional().nullable(),
    autoClose: z.boolean().default(false),
    pauseAllowed: z.boolean().default(true),
    isActive: z.boolean().default(true),
  })
  .strict();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z
  .object({
    name: z.string().min(1).trim().optional(),
    description: z.string().trim().optional().nullable(),
    billingFrequency: z.nativeEnum(BillingFrequency).optional(),
    minQuantity: z.number().int().min(1).optional(),
    availableFrom: z.string().datetime().optional().nullable(),
    availableUntil: z.string().datetime().optional().nullable(),
    autoClose: z.boolean().optional(),
    pauseAllowed: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const calculatePriceSchema = z
  .object({
    productId: z.string().uuid('Invalid product ID'),
    variantIds: z.array(z.string().uuid()).default([]),
    quantity: z.number().int().min(1).default(1),
  })
  .strict();

export type CalculatePriceInput = z.infer<typeof calculatePriceSchema>;
