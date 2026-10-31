import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure DATABASE_URL is loaded from root or api .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../apps/api/.env') });

import {
  prisma,
  Role,
  PaymentMethod,
  SubscriptionStatus,
  InvoiceStatus,
  BillingFrequency,
  DiscountType,
  BillingAttemptStatus,
} from '../src/index.js';

const DEMO_PASSWORD = 'Brightloop#2026!';
const SALT_ROUNDS = 12;

async function main() {
  console.log('🚀 Starting Brightloop Database Seeder...');

  // =========================================================================
  // 1. CLEANUP DATABASE IN PROPER FK DEPENDENCY ORDER
  // =========================================================================
  console.log('🧹 Purging existing transactional data...');
  await prisma.billingAttempt.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // Reset native PostgreSQL sequences
  console.log('🔄 Setting sequence generators...');
  await prisma.$executeRawUnsafe(`SELECT setval('sub_seq', 10, true)`);
  await prisma.$executeRawUnsafe(`SELECT setval('inv_seq', 10, true)`);
  await prisma.$executeRawUnsafe(`SELECT setval('pay_seq', 10, true)`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // =========================================================================
  // 2. SEED USERS & ROLES
  // =========================================================================
  console.log('👤 Seeding role accounts (Admin, Staff, Customers)...');

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@brightloop.io',
      passwordHash,
      fullName: 'System Administrator',
      role: Role.ADMIN,
      companyName: 'Brightloop Software HQ',
      billingAddress: '100 Innovation Way, Bangalore, KA 560100, India',
      taxId: '29AAACB1234F1Z5',
      creditBalance: 0.0,
      isActive: true,
    },
  });

  // Staff
  const staff = await prisma.user.create({
    data: {
      email: 'staff@brightloop.io',
      passwordHash,
      fullName: 'Support & Billing Staff',
      role: Role.STAFF,
      companyName: 'Brightloop Operations',
      billingAddress: '100 Innovation Way, Bangalore, KA 560100, India',
      taxId: '29AAACB1234F1Z5',
      creditBalance: 0.0,
      isActive: true,
    },
  });

  // Customer 1: Acme Global Technologies (Enterprise with 1500.00 Credit Surplus)
  const customerAcme = await prisma.user.create({
    data: {
      email: 'enterprise@acme.com',
      passwordHash,
      fullName: 'Acme Global Technologies',
      role: Role.CUSTOMER,
      companyName: 'Acme Corporation Pvt Ltd',
      billingAddress: 'Tower B, Cyber City, Phase II, Gurgaon, HR 122002, India',
      taxId: '07AAACA1234A1Z1',
      creditBalance: 1500.0, // Surplus credited to balance
      isActive: true,
    },
  });

  // Customer 2: DevFlow Cloud Labs (Growing Startup)
  const customerDevFlow = await prisma.user.create({
    data: {
      email: 'founder@startup.io',
      passwordHash,
      fullName: 'DevFlow Cloud Labs',
      role: Role.CUSTOMER,
      companyName: 'DevFlow Technologies Inc',
      billingAddress: 'Indiranagar 100ft Road, Bangalore, KA 560038, India',
      taxId: '29AAACD5678B1Z2',
      creditBalance: 0.0,
      isActive: true,
    },
  });

  // Customer 3: Globex Global Services (Has Overdue Invoice)
  const customerGlobex = await prisma.user.create({
    data: {
      email: 'finance@globex.org',
      passwordHash,
      fullName: 'Globex Global Services',
      role: Role.CUSTOMER,
      companyName: 'Globex Logistics & Supply Chain Ltd',
      billingAddress: 'Express Highway Sector 18, Chennai, TN 600001, India',
      taxId: '33AAACG9012C1Z3',
      creditBalance: 250.0,
      isActive: true,
    },
  });

  // =========================================================================
  // 3. SEED PRODUCTS & VARIANTS
  // =========================================================================
  console.log('📦 Seeding product catalog & dynamic variants...');

  // Product 1: Core SaaS
  const coreProduct = await prisma.product.create({
    data: {
      name: 'Brightloop Core SaaS Platform',
      description: 'Enterprise subscription lifecycle billing and financial metrics engine',
      type: 'SERVICE',
      salesPrice: 1500.0,
      costPrice: 350.0,
      isAvailable: true,
      variants: {
        create: [
          {
            attributeName: 'Hosting Tier',
            attributeValue: 'Multi-Tenant Cloud',
            priceAdjustment: 0.0,
            isAvailable: true,
          },
          {
            attributeName: 'Hosting Tier',
            attributeValue: 'Dedicated Private Cloud',
            priceAdjustment: 500.0,
            isAvailable: true,
          },
          {
            attributeName: 'Hosting Tier',
            attributeValue: 'On-Premises Isolated Node',
            priceAdjustment: 1200.0,
            isAvailable: true,
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 2: AI Predictor
  const aiProduct = await prisma.product.create({
    data: {
      name: 'AI Revenue & Churn Predictor',
      description: 'Real-time ARR churn risk forecasting and intelligent usage analytics',
      type: 'SERVICE',
      salesPrice: 800.0,
      costPrice: 150.0,
      isAvailable: true,
      variants: {
        create: [
          {
            attributeName: 'Subscriber Capacity',
            attributeValue: 'Up to 5,000 Subscribers',
            priceAdjustment: 0.0,
            isAvailable: true,
          },
          {
            attributeName: 'Subscriber Capacity',
            attributeValue: 'Up to 50,000 Subscribers',
            priceAdjustment: 450.0,
            isAvailable: true,
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 3: SLA Support
  const supportProduct = await prisma.product.create({
    data: {
      name: '24/7 Dedicated SRE & Priority Support SLA',
      description: '15-minute response SLA with dedicated Solutions Architect and quarterly billing audit',
      type: 'SERVICE',
      salesPrice: 600.0,
      costPrice: 200.0,
      isAvailable: true,
      variants: {
        create: [
          {
            attributeName: 'Coverage Window',
            attributeValue: 'Business Hours (8x5)',
            priceAdjustment: 0.0,
            isAvailable: true,
          },
          {
            attributeName: 'Coverage Window',
            attributeValue: 'Mission Critical (24x7)',
            priceAdjustment: 400.0,
            isAvailable: true,
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 4: Secure Vault
  await prisma.product.create({
    data: {
      name: 'Secure Cloud Audit Storage Vault',
      description: 'WORM-compliant encrypted 10-year financial records archive with tamper-evident hashing',
      type: 'SERVICE',
      salesPrice: 300.0,
      costPrice: 50.0,
      isAvailable: true,
    },
  });

  // =========================================================================
  // 4. SEED SUBSCRIPTION PLANS
  // =========================================================================
  console.log('📋 Seeding subscription plans...');

  const monthlyPlan = await prisma.plan.create({
    data: {
      name: 'Enterprise Monthly Plan',
      description: 'In-advance monthly recurring subscription with 30-day billing cycle',
      billingFrequency: BillingFrequency.MONTHLY,
      minQuantity: 1,
      pauseAllowed: true,
      autoClose: false,
      isActive: true,
    },
  });

  await prisma.plan.create({
    data: {
      name: 'Annual Prepaid Growth Plan',
      description: 'Annual billed subscription with automatic renewal terms',
      billingFrequency: BillingFrequency.YEARLY,
      minQuantity: 1,
      pauseAllowed: true,
      autoClose: false,
      isActive: true,
    },
  });

  const weeklyPlan = await prisma.plan.create({
    data: {
      name: 'Weekly Pilot Plan',
      description: 'Rapid 7-day evaluation cycle with automated closure',
      billingFrequency: BillingFrequency.WEEKLY,
      minQuantity: 1,
      pauseAllowed: false,
      autoClose: true,
      isActive: true,
    },
  });

  // =========================================================================
  // 5. SEED PROMOTIONAL DISCOUNTS
  // =========================================================================
  console.log('🏷️ Seeding promotional discounts & coupons...');

  await prisma.discount.create({
    data: {
      code: 'SAVE20',
      name: 'Spring Promotional Discount',
      description: '20% off all eligible SaaS subscription orders above ₹1,000',
      type: DiscountType.PERCENTAGE,
      value: 20.0,
      minPurchaseAmount: 1000.0,
      usageLimit: 100,
      usedCount: 5,
      isActive: true,
    },
  });

  await prisma.discount.create({
    data: {
      code: 'FLAT500',
      name: 'Enterprise Onboarding Voucher',
      description: 'Flat ₹500 discount for orders above ₹2,000',
      type: DiscountType.FIXED_AMOUNT,
      value: 500.0,
      minPurchaseAmount: 2000.0,
      usageLimit: 50,
      usedCount: 2,
      isActive: true,
    },
  });

  await prisma.discount.create({
    data: {
      code: 'EXPIRED10',
      name: 'Legacy Beta Coupon',
      description: '10% promotional coupon past validity window',
      type: DiscountType.PERCENTAGE,
      value: 10.0,
      validUntil: new Date(Date.now() - 30 * 86400000),
      usageLimit: 20,
      usedCount: 20,
      isActive: false,
    },
  });

  // =========================================================================
  // 6. SEED MULTI-STATE SUBSCRIPTIONS & INVOICES
  // =========================================================================
  console.log('🔄 Seeding subscriptions, recurring cycles, and invoices...');

  // --- SUB 1: Acme Global (ACTIVE, Monthly Plan) ---
  const dedicatedVariant = coreProduct.variants.find((v) => v.priceAdjustment.toNumber() === 500.0)!;
  const missionCriticalVariant = supportProduct.variants.find((v) => v.priceAdjustment.toNumber() === 400.0)!;

  const acmeStartDate = new Date(Date.now() - 60 * 86400000); // 60 days ago
  const acmeNextBilling = new Date(Date.now() + 12 * 86400000); // 12 days in future

  const acmeSub = await prisma.subscription.create({
    data: {
      subscriptionNumber: 'SUB-2026-00001',
      customerId: customerAcme.id,
      planId: monthlyPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: acmeStartDate,
      nextBillingDate: acmeNextBilling,
      paymentTermsDays: 15,
      lines: {
        create: [
          {
            productId: coreProduct.id,
            variantId: dedicatedVariant.id,
            quantity: 2,
            unitPrice: 1500.0,
            variantAdjustment: 500.0,
            taxRate: 18.0,
            subtotal: 4000.0,
            taxAmount: 720.0,
            totalAmount: 4720.0,
          },
          {
            productId: supportProduct.id,
            variantId: missionCriticalVariant.id,
            quantity: 1,
            unitPrice: 600.0,
            variantAdjustment: 400.0,
            taxRate: 18.0,
            subtotal: 1000.0,
            taxAmount: 180.0,
            totalAmount: 1180.0,
          },
        ],
      },
    },
  });

  // Invoice 1: Acme (Period: 60 to 30 days ago, PAID in full)
  const acmeInv1PeriodStart = new Date(Date.now() - 60 * 86400000);
  const acmeInv1PeriodEnd = new Date(Date.now() - 30 * 86400000);
  const acmeInv1Due = new Date(Date.now() - 45 * 86400000);

  const acmeInv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-00001',
      subscriptionId: acmeSub.id,
      customerId: customerAcme.id,
      status: InvoiceStatus.PAID,
      periodStartDate: acmeInv1PeriodStart,
      periodEndDate: acmeInv1PeriodEnd,
      dueDate: acmeInv1Due,
      subtotal: 5000.0,
      taxAmount: 900.0,
      totalAmount: 5900.0,
      paidAmount: 5900.0,
      lines: {
        create: [
          {
            productId: coreProduct.id,
            variantId: dedicatedVariant.id,
            description: 'Brightloop Core SaaS Platform (Dedicated Private Cloud)',
            quantity: 2,
            unitPrice: 2000.0,
            taxRate: 18.0,
            subtotal: 4000.0,
            taxAmount: 720.0,
            totalAmount: 4720.0,
          },
          {
            productId: supportProduct.id,
            variantId: missionCriticalVariant.id,
            description: '24/7 Dedicated SRE & Priority Support SLA (Mission Critical)',
            quantity: 1,
            unitPrice: 1000.0,
            taxRate: 18.0,
            subtotal: 1000.0,
            taxAmount: 180.0,
            totalAmount: 1180.0,
          },
        ],
      },
    },
  });

  // Invoice 2: Acme (Period: 30 days ago to now, PAID in full with wire transfer that created surplus)
  const acmeInv2PeriodStart = new Date(Date.now() - 30 * 86400000);
  const acmeInv2PeriodEnd = new Date();
  const acmeInv2Due = new Date(Date.now() - 15 * 86400000);

  const acmeInv2 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-00002',
      subscriptionId: acmeSub.id,
      customerId: customerAcme.id,
      status: InvoiceStatus.PAID,
      periodStartDate: acmeInv2PeriodStart,
      periodEndDate: acmeInv2PeriodEnd,
      dueDate: acmeInv2Due,
      subtotal: 5000.0,
      taxAmount: 900.0,
      totalAmount: 5900.0,
      paidAmount: 5900.0,
      lines: {
        create: [
          {
            productId: coreProduct.id,
            variantId: dedicatedVariant.id,
            description: 'Brightloop Core SaaS Platform (Dedicated Private Cloud)',
            quantity: 2,
            unitPrice: 2000.0,
            taxRate: 18.0,
            subtotal: 4000.0,
            taxAmount: 720.0,
            totalAmount: 4720.0,
          },
          {
            productId: supportProduct.id,
            variantId: missionCriticalVariant.id,
            description: '24/7 Dedicated SRE & Priority Support SLA (Mission Critical)',
            quantity: 1,
            unitPrice: 1000.0,
            taxRate: 18.0,
            subtotal: 1000.0,
            taxAmount: 180.0,
            totalAmount: 1180.0,
          },
        ],
      },
    },
  });

  // Invoice 3: Acme (Current upcoming period, CONFIRMED, ready for credit settlement demo!)
  const acmeInv3PeriodStart = new Date();
  const acmeInv3PeriodEnd = new Date(Date.now() + 30 * 86400000);
  const acmeInv3Due = new Date(Date.now() + 12 * 86400000);

  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-00003',
      subscriptionId: acmeSub.id,
      customerId: customerAcme.id,
      status: InvoiceStatus.CONFIRMED,
      periodStartDate: acmeInv3PeriodStart,
      periodEndDate: acmeInv3PeriodEnd,
      dueDate: acmeInv3Due,
      subtotal: 5000.0,
      taxAmount: 900.0,
      totalAmount: 5900.0,
      paidAmount: 0.0,
      lines: {
        create: [
          {
            productId: coreProduct.id,
            variantId: dedicatedVariant.id,
            description: 'Brightloop Core SaaS Platform (Dedicated Private Cloud)',
            quantity: 2,
            unitPrice: 2000.0,
            taxRate: 18.0,
            subtotal: 4000.0,
            taxAmount: 720.0,
            totalAmount: 4720.0,
          },
          {
            productId: supportProduct.id,
            variantId: missionCriticalVariant.id,
            description: '24/7 Dedicated SRE & Priority Support SLA (Mission Critical)',
            quantity: 1,
            unitPrice: 1000.0,
            taxRate: 18.0,
            subtotal: 1000.0,
            taxAmount: 180.0,
            totalAmount: 1180.0,
          },
        ],
      },
    },
  });

  // --- SUB 2: DevFlow (CONFIRMED Quotation, with partial payment invoice) ---
  const multiTenantVariant = coreProduct.variants.find((v) => v.priceAdjustment.toNumber() === 0.0)!;

  const devFlowSub = await prisma.subscription.create({
    data: {
      subscriptionNumber: 'SUB-2026-00002',
      customerId: customerDevFlow.id,
      planId: monthlyPlan.id,
      status: SubscriptionStatus.CONFIRMED,
      paymentTermsDays: 15,
      lines: {
        create: [
          {
            productId: coreProduct.id,
            variantId: multiTenantVariant.id,
            quantity: 1,
            unitPrice: 1500.0,
            variantAdjustment: 0.0,
            taxRate: 18.0,
            subtotal: 1500.0,
            taxAmount: 270.0,
            totalAmount: 1770.0,
          },
        ],
      },
    },
  });

  // Invoice 4: DevFlow (PARTIALLY_PAID: total 1770.00, paid 1000.00, balance 770.00)
  const devFlowInvPeriodStart = new Date(Date.now() - 10 * 86400000);
  const devFlowInvPeriodEnd = new Date(Date.now() + 20 * 86400000);
  const devFlowInvDue = new Date(Date.now() + 5 * 86400000);

  const devFlowInv = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-00004',
      subscriptionId: devFlowSub.id,
      customerId: customerDevFlow.id,
      status: InvoiceStatus.PARTIALLY_PAID,
      periodStartDate: devFlowInvPeriodStart,
      periodEndDate: devFlowInvPeriodEnd,
      dueDate: devFlowInvDue,
      subtotal: 1500.0,
      taxAmount: 270.0,
      totalAmount: 1770.0,
      paidAmount: 1000.0,
      lines: {
        create: [
          {
            productId: coreProduct.id,
            variantId: multiTenantVariant.id,
            description: 'Brightloop Core SaaS Platform (Multi-Tenant Cloud)',
            quantity: 1,
            unitPrice: 1500.0,
            taxRate: 18.0,
            subtotal: 1500.0,
            taxAmount: 270.0,
            totalAmount: 1770.0,
          },
        ],
      },
    },
  });

  // --- SUB 3: DevFlow (Open QUOTATION for AI Predictor) ---
  const aiCapacityVariant = aiProduct.variants.find((v) => v.priceAdjustment.toNumber() === 0.0)!;

  await prisma.subscription.create({
    data: {
      subscriptionNumber: 'SUB-2026-00003',
      customerId: customerDevFlow.id,
      planId: weeklyPlan.id,
      status: SubscriptionStatus.QUOTATION,
      quoteValidUntil: new Date(Date.now() + 14 * 86400000),
      paymentTermsDays: 7,
      lines: {
        create: [
          {
            productId: aiProduct.id,
            variantId: aiCapacityVariant.id,
            quantity: 1,
            unitPrice: 800.0,
            variantAdjustment: 0.0,
            taxRate: 18.0,
            subtotal: 800.0,
            taxAmount: 144.0,
            totalAmount: 944.0,
          },
        ],
      },
    },
  });

  // --- SUB 4: Globex (ACTIVE with OVERDUE Invoice) ---
  const globexStartDate = new Date(Date.now() - 40 * 86400000);
  const globexNextBilling = new Date(Date.now() + 20 * 86400000);

  const globexSub = await prisma.subscription.create({
    data: {
      subscriptionNumber: 'SUB-2026-00004',
      customerId: customerGlobex.id,
      planId: monthlyPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: globexStartDate,
      nextBillingDate: globexNextBilling,
      paymentTermsDays: 30,
      lines: {
        create: [
          {
            productId: coreProduct.id,
            variantId: multiTenantVariant.id,
            quantity: 2,
            unitPrice: 1500.0,
            variantAdjustment: 0.0,
            taxRate: 18.0,
            subtotal: 3000.0,
            taxAmount: 540.0,
            totalAmount: 3540.0,
          },
        ],
      },
    },
  });

  // Invoice 5: Globex (CONFIRMED, Due Date 10 days ago -> Dynamically evaluated as OVERDUE per D-09!)
  const globexInvPeriodStart = new Date(Date.now() - 40 * 86400000);
  const globexInvPeriodEnd = new Date(Date.now() - 10 * 86400000);
  const globexPastDue = new Date(Date.now() - 10 * 86400000); // 10 days ago!

  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-00005',
      subscriptionId: globexSub.id,
      customerId: customerGlobex.id,
      status: InvoiceStatus.CONFIRMED,
      periodStartDate: globexInvPeriodStart,
      periodEndDate: globexInvPeriodEnd,
      dueDate: globexPastDue,
      subtotal: 3000.0,
      taxAmount: 540.0,
      totalAmount: 3540.0,
      paidAmount: 0.0,
      lines: {
        create: [
          {
            productId: coreProduct.id,
            variantId: multiTenantVariant.id,
            description: 'Brightloop Core SaaS Platform (Multi-Tenant Cloud)',
            quantity: 2,
            unitPrice: 1500.0,
            taxRate: 18.0,
            subtotal: 3000.0,
            taxAmount: 540.0,
            totalAmount: 3540.0,
          },
        ],
      },
    },
  });

  // =========================================================================
  // 7. SEED PAYMENTS, ALLOCATIONS, AND SURPLUS
  // =========================================================================
  console.log('💳 Seeding historical payments & surplus transactions...');

  // Payment 1: Acme Invoice 1 full payment
  const payment1 = await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-2026-00001',
      customerId: customerAcme.id,
      amount: 5900.0,
      method: PaymentMethod.MANUAL_BANK_TRANSFER,
      notes: 'NEFT Transfer ref #ACME-2026-001 settled in full',
      recordedById: admin.id,
      paymentDate: new Date(Date.now() - 45 * 86400000),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: payment1.id,
      invoiceId: acmeInv1.id,
      amount: 5900.0,
    },
  });

  // Payment 2: Acme Invoice 2 payment with SURPLUS of 1500.00 (Total 7400.00)
  const payment2 = await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-2026-00002',
      customerId: customerAcme.id,
      amount: 7400.0,
      method: PaymentMethod.MANUAL_BANK_TRANSFER,
      notes: 'RTGS wire with surplus advance for future subscriptions',
      recordedById: staff.id,
      paymentDate: new Date(Date.now() - 15 * 86400000),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: payment2.id,
      invoiceId: acmeInv2.id,
      amount: 5900.0,
    },
  });

  // Payment 3: DevFlow Invoice 4 partial payment (1000.00 of 1770.00)
  const payment3 = await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-2026-00003',
      customerId: customerDevFlow.id,
      amount: 1000.0,
      method: PaymentMethod.CHEQUE,
      notes: 'HDFC Cheque #880912 partial deposit',
      recordedById: staff.id,
      paymentDate: new Date(Date.now() - 5 * 86400000),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: payment3.id,
      invoiceId: devFlowInv.id,
      amount: 1000.0,
    },
  });

  // =========================================================================
  // 8. SEED BILLING ATTEMPTS & AUDIT LOGS
  // =========================================================================
  console.log('📜 Seeding billing worker attempts & security audit logs...');

  await prisma.billingAttempt.create({
    data: {
      subscriptionId: acmeSub.id,
      invoiceId: acmeInv2.id,
      attemptDate: new Date(Date.now() - 30 * 86400000),
      status: BillingAttemptStatus.SUCCESS,
    },
  });

  await prisma.billingAttempt.create({
    data: {
      subscriptionId: globexSub.id,
      attemptDate: new Date(Date.now() - 40 * 86400000),
      status: BillingAttemptStatus.SUCCESS,
    },
  });

  // Audit Logs
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: customerAcme.id,
      newValues: { email: customerAcme.email, role: 'CUSTOMER', fullName: customerAcme.fullName },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: staff.id,
      actorRole: 'STAFF',
      action: 'PAYMENT_SURPLUS_CREDITED',
      entityType: 'User',
      entityId: customerAcme.id,
      newValues: {
        paymentNumber: 'PAY-2026-00002',
        surplusAmount: '1500.00',
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: customerDevFlow.id,
      actorRole: 'CUSTOMER',
      action: 'QUOTATION_CONFIRMED',
      entityType: 'Subscription',
      entityId: devFlowSub.id,
      newValues: { status: 'CONFIRMED', subscriptionNumber: 'SUB-2026-00002' },
    },
  });

  console.log('✅ Brightloop database seeding completed successfully!');
  console.log('---------------------------------------------------------');
  console.log('👑 Admin:     admin@brightloop.io     | Brightloop#2026!');
  console.log('👔 Staff:     staff@brightloop.io     | Brightloop#2026!');
  console.log('🏢 Customer:  enterprise@acme.com     | Brightloop#2026! (Credit: ₹1,500.00)');
  console.log('🚀 Customer:  founder@startup.io      | Brightloop#2026! (Partial Payment & Open Quote)');
  console.log('⚠️ Customer:  finance@globex.org      | Brightloop#2026! (Overdue Invoice)');
  console.log('---------------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seeder failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
