import { z } from 'zod';
import { passwordSchema } from '../auth/schema.js';

export const createStaffSchema = z
  .object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: passwordSchema,
    fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
  })
  .strict();

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const userQuerySchema = z.object({
  role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UserQueryInput = z.infer<typeof userQuerySchema>;

export const updateProfileSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').trim().optional(),
    companyName: z.string().trim().max(120).nullable().optional(),
    taxId: z.string().trim().max(50).nullable().optional(),
    billingAddress: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;

export const creditHistoryQuerySchema = z.object({
  customerId: z.string().trim().optional(),
});

export type CreditHistoryQueryInput = z.infer<typeof creditHistoryQuerySchema>;
