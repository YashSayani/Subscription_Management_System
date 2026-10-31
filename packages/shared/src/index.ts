import { z } from 'zod';

// Roles
export const UserRole = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Subscription State Machine Enums
export const SubscriptionStatus = {
  DRAFT: 'DRAFT',
  QUOTATION: 'QUOTATION',
  CONFIRMED: 'CONFIRMED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

// Invoice State Machine Enums
export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

// Billing Frequencies
export const BillingFrequency = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type BillingFrequency = (typeof BillingFrequency)[keyof typeof BillingFrequency];

// Payment Methods (Manual Recording Only)
export const PaymentMethod = {
  MANUAL_BANK_TRANSFER: 'MANUAL_BANK_TRANSFER',
  CASH: 'CASH',
  CHEQUE: 'CHEQUE',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

// Discount Types
export const DiscountType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
} as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

// Billing Attempt Status
export const BillingAttemptStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
} as const;
export type BillingAttemptStatus = (typeof BillingAttemptStatus)[keyof typeof BillingAttemptStatus];

// Health Check Contract
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptime: z.number().nonnegative(),
  database: z.object({
    connected: z.boolean(),
    latencyMs: z.number().nonnegative(),
    databaseName: z.string(),
  }),
  environment: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Standard API Success & Error envelope contracts
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

// Catalog DTOs
export interface ProductVariantDto {
  id: string;
  productId: string;
  attributeName: string;
  attributeValue: string;
  priceAdjustment: string | number;
  isAvailable: boolean;
  createdAt?: string;
}

export interface ProductDto {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  salesPrice: string | number;
  costPrice: string | number;
  notes?: string | null;
  isAvailable: boolean;
  createdAt: string;
  variants: ProductVariantDto[];
}

export interface PlanDto {
  id: string;
  name: string;
  description?: string | null;
  billingFrequency: BillingFrequency;
  minQuantity: number;
  availableFrom?: string | null;
  availableUntil?: string | null;
  autoClose: boolean;
  pauseAllowed: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PriceCalculationDto {
  productId: string;
  productName: string;
  basePrice: string;
  variants: Array<{
    id: string;
    attributeName: string;
    attributeValue: string;
    priceAdjustment: string;
  }>;
  sumAdjustments: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
