import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(9, 'Password must be at least 9 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=~/\\`[\]]/, 'Password must contain at least one special character');

export const registerSchema = z
  .object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: passwordSchema,
    fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
    companyName: z.string().trim().optional(),
    taxId: z.string().trim().optional(),
    billingAddress: z.string().trim().optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z
  .object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
  })
  .strict();

export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required').trim(),
    newPassword: passwordSchema,
  })
  .strict();

export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
