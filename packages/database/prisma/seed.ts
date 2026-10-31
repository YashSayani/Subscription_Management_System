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
  BillingFrequency,
  DiscountType,
} from '../src/index.js';

const DEMO_PASSWORD = 'Brightloop#2026!';
const SALT_ROUNDS = 12;

async function main() {
  console.log('🚀 Starting Clean Brightloop Database Seeder...');

  // =========================================================================
  // 1. DROP EVERY DUMMY DATA FROM DATABASE
  // =========================================================================
  console.log('🧹 Dropping all dummy transactions and existing data...');
  await prisma.billingAttempt.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.quotationTemplate.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // Reset native PostgreSQL sequences to start clean from 1
  console.log('🔄 Resetting sequence generators to 1...');
  try {
    await prisma.$executeRawUnsafe(`SELECT setval('sub_seq', 1, false)`);
    await prisma.$executeRawUnsafe(`SELECT setval('inv_seq', 1, false)`);
    await prisma.$executeRawUnsafe(`SELECT setval('pay_seq', 1, false)`);
  } catch (err: unknown) {
    console.warn('⚠️ Sequence reset warning:', (err as Error).message);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // =========================================================================
  // 2. SEED FOUNDATIONAL ACCOUNTS (Admin, Staff, Customer)
  // =========================================================================
  console.log('👤 Seeding clean role accounts...');

  // Admin
  await prisma.user.create({
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
  await prisma.user.create({
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

  // Primary Customer
  await prisma.user.create({
    data: {
      email: 'customer@brightloop.io',
      passwordHash,
      fullName: 'Brightloop Customer',
      role: Role.CUSTOMER,
      companyName: 'Brightloop Cloud Services',
      billingAddress: 'Tower B, Cyber City, Phase II, Gurgaon, HR 122002, India',
      taxId: '07AAACA1234A1Z1',
      creditBalance: 0.0,
      isActive: true,
    },
  });

  // Enterprise Customer
  await prisma.user.create({
    data: {
      email: 'enterprise@acme.com',
      passwordHash,
      fullName: 'Acme Global Technologies',
      role: Role.CUSTOMER,
      companyName: 'Acme Corporation Pvt Ltd',
      billingAddress: '42 Tech Park Avenue, Bangalore, KA 560066, India',
      taxId: '29AAACA5678B1Z9',
      creditBalance: 0.0,
      isActive: true,
    },
  });

  // =========================================================================
  // 3. SEED PRODUCT CATALOG & VARIANTS
  // =========================================================================
  console.log('📦 Seeding product catalog & dynamic variants...');

  // Product 1: Core SaaS Platform
  await prisma.product.create({
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
  });

  // Product 2: AI Revenue Predictor
  await prisma.product.create({
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
  });

  // Product 3: 24/7 SRE Support SLA
  await prisma.product.create({
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
  });

  // Product 4: Secure Storage Vault
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

  await prisma.plan.create({
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

  await prisma.plan.create({
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
      usedCount: 0,
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
      usedCount: 0,
      isActive: true,
    },
  });

  // Verify counts
  const [uCount, pCount, plCount, dCount, sCount, iCount, payCount] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.plan.count(),
    prisma.discount.count(),
    prisma.subscription.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
  ]);

  console.log('✅ Database seeded cleanly with zero dummy data!');
  console.log(`Current Counts: Users: ${uCount}, Products: ${pCount}, Plans: ${plCount}, Discounts: ${dCount}`);
  console.log(`Dummy Data Counts: Subscriptions: ${sCount}, Invoices: ${iCount}, Payments: ${payCount}`);
  console.log('---------------------------------------------------------');
  console.log('👑 Admin:     admin@brightloop.io     | Brightloop#2026!');
  console.log('👔 Staff:     staff@brightloop.io     | Brightloop#2026!');
  console.log('🏢 Customer:  customer@brightloop.io  | Brightloop#2026!');
  console.log('🏢 Customer:  enterprise@acme.com     | Brightloop#2026!');
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
