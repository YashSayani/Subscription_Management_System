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

// User DTOs
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyName?: string | null;
  taxId?: string | null;
  billingAddress?: string | null;
  creditBalance: string | number;
  isActive: boolean;
  createdAt: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  companyName?: string | null;
  taxId?: string | null;
  billingAddress?: string | null;
}

export interface UserProfileDto extends UserDto {
  updatedAt?: string;
}

export type CreditTransactionType = 'CREDIT' | 'DEBIT';

export interface CreditLedgerEntryDto {
  id: string;
  date: string;
  type: CreditTransactionType;
  amount: string;
  reference: string;
  description: string;
}

export interface CustomerCreditHistoryDto {
  customerId: string;
  creditBalance: string;
  transactions: CreditLedgerEntryDto[];
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

// Subscription & Quotation DTOs
export interface SubscriptionLineDto {
  id: string;
  subscriptionId: string;
  productId: string;
  variantId?: string | null;
  product?: {
    id: string;
    name: string;
    salesPrice: string | number;
  };
  variant?: {
    id: string;
    attributeName: string;
    attributeValue: string;
    priceAdjustment: string | number;
  } | null;
  quantity: number;
  unitPrice: string | number;
  variantAdjustment: string | number;
  taxRate: string | number;
  subtotal: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  createdAt: string;
}

export interface SubscriptionDto {
  id: string;
  subscriptionNumber: string;
  customerId: string;
  customer?: {
    id: string;
    email: string;
    fullName: string;
    companyName?: string | null;
  };
  planId: string;
  plan?: PlanDto;
  status: SubscriptionStatus;
  quoteValidUntil?: string | null;
  startDate?: string | null;
  nextBillingDate?: string | null;
  endDate?: string | null;
  paymentTermsDays: number;
  pausedAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  lines: SubscriptionLineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface QuotationTemplateDto {
  id: string;
  name: string;
  description?: string | null;
  templateLines: unknown;
  isActive: boolean;
  createdAt: string;
}

// Invoice DTOs
export interface InvoiceLineDto {
  id: string;
  invoiceId: string;
  productId: string;
  variantId?: string | null;
  description: string;
  quantity: number;
  unitPrice: string | number;
  variantAdjustment: string | number;
  taxRate: string | number;
  subtotal: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  createdAt: string;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  subscriptionId: string;
  subscription?: {
    id: string;
    subscriptionNumber: string;
    plan?: {
      name: string;
      billingFrequency: BillingFrequency;
    };
  };
  customerId: string;
  customer?: {
    id: string;
    email: string;
    fullName: string;
    companyName?: string | null;
    taxId?: string | null;
    billingAddress?: string | null;
  };
  status: InvoiceStatus;
  isOverdue: boolean;
  periodStartDate: string;
  periodEndDate: string;
  dueDate: string;
  subtotal: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  balanceDue: string | number;
  discountId?: string | null;
  notes?: string | null;
  lines: InvoiceLineDto[];
  allocations?: Array<{
    id: string;
    amount: string | number;
    createdAt: string;
    payment?: {
      paymentNumber: string;
      method: string;
      paymentDate: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

// Payment DTOs
export interface PaymentAllocationDto {
  id: string;
  paymentId: string;
  invoiceId: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: string | number;
    paidAmount: string | number;
    status: InvoiceStatus;
    dueDate: string;
  };
  amount: string | number;
  allocatedAt: string;
}

export interface PaymentDto {
  id: string;
  paymentNumber: string;
  customerId: string;
  customer?: {
    id: string;
    email: string;
    fullName: string;
    companyName?: string | null;
    creditBalance?: string | number;
  };
  paymentDate: string;
  amount: string | number;
  method: PaymentMethod;
  notes?: string | null;
  recordedById: string;
  recordedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  allocations: PaymentAllocationDto[];
  totalAllocated: string | number;
  surplusAmount: string | number;
  createdAt: string;
}

// Discount DTOs
export interface DiscountDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: DiscountType;
  value: string | number;
  minPurchaseAmount?: string | number | null;
  minQuantity?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  usageLimit?: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountValidationResultDto {
  valid: boolean;
  discountId: string;
  code: string;
  name: string;
  type: DiscountType;
  value: string | number;
  discountAmount: string | number;
  newSubtotal: string | number;
  message?: string;
}

// Analytics DTOs
export interface AnalyticsOverviewDto {
  mrr: string | number;
  arr: string | number;
  totalRevenueCollected: string | number;
  outstandingArBalance: string | number;
  overdueBalance: string | number;
  overdueInvoicesCount: number;
  activeSubscriptionsCount: number;
  pausedSubscriptionsCount: number;
  closedSubscriptionsCount: number;
  totalSubscriptionsCount: number;
  churnRate: string | number;
}

export interface AgingReportBracketDto {
  bracket: 'CURRENT' | 'DAYS_1_30' | 'DAYS_31_60' | 'DAYS_61_90' | 'DAYS_90_PLUS';
  label: string;
  count: number;
  totalAmount: string | number;
}

export interface OverdueInvoiceSummaryDto {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  dueDate: string;
  daysOverdue: number;
  totalAmount: string | number;
  paidAmount: string | number;
  balanceDue: string | number;
  status: InvoiceStatus;
}

export interface AgingReportDto {
  totalOutstanding: string | number;
  totalOverdue: string | number;
  brackets: AgingReportBracketDto[];
  overdueInvoices: OverdueInvoiceSummaryDto[];
}

export interface RevenueTrendItemDto {
  month: string;
  billedAmount: string | number;
  collectedAmount: string | number;
  newSubscriptionsCount: number;
}

export interface RevenueTrendsDto {
  trends: RevenueTrendItemDto[];
}

// Password Reset DTOs
export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

// Audit Log DTOs
export interface AuditLogActorDto {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface AuditLogDto {
  id: string;
  actorId?: string | null;
  actor?: AuditLogActorDto | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  createdAt: string;
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
