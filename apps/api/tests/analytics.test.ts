import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import {
  prisma,
  Role,
  BillingFrequency,
  SubscriptionStatus,
  InvoiceStatus,
  PaymentMethod,
} from '@brightloop/database';

describe('Real-time Analytics Dashboard Module', () => {
  let adminCookie: string;
  let staffCookie: string;
  let customerCookie: string;

  beforeAll(async () => {
    // Clean up
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

    // 1. Create Admin
    const adminPasswordHash = await bcrypt.hash('AdminPass#123', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'analytics-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Analytics Admin',
        role: Role.ADMIN,
        isActive: true,
      },
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: admin.email, password: 'AdminPass#123' });
    adminCookie =
      adminLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 2. Create Staff
    const staffPasswordHash = await bcrypt.hash('StaffPass#123', 12);
    const staff = await prisma.user.create({
      data: {
        email: 'analytics-staff@brightloop.io',
        passwordHash: staffPasswordHash,
        fullName: 'Analytics Staff',
        role: Role.STAFF,
        isActive: true,
      },
    });

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: staff.email, password: 'StaffPass#123' });
    staffCookie =
      staffLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 3. Create Customer
    const custPasswordHash = await bcrypt.hash('CustomerPass#123', 12);
    const customer = await prisma.user.create({
      data: {
        email: 'analytics-cust@brightloop.io',
        passwordHash: custPasswordHash,
        fullName: 'Analytics Customer',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });

    const custLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: customer.email, password: 'CustomerPass#123' });
    customerCookie =
      custLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 4. Create Plans with different billing frequencies
    const monthlyPlan = await prisma.plan.create({
      data: {
        name: 'Pro Monthly Plan',
        billingFrequency: BillingFrequency.MONTHLY,
        minQuantity: 1,
      },
    });

    const yearlyPlan = await prisma.plan.create({
      data: {
        name: 'Pro Yearly Plan',
        billingFrequency: BillingFrequency.YEARLY,
        minQuantity: 1,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Core Software License',
        salesPrice: 1000.0,
        costPrice: 200.0,
      },
    });

    // 5. Create Subscriptions
    // Monthly sub: ₹1,000/mo -> MRR contribution = 1,000
    const subMonthly = await prisma.subscription.create({
      data: {
        subscriptionNumber: 'SUB-2026-80001',
        customerId: customer.id,
        planId: monthlyPlan.id,
        status: SubscriptionStatus.ACTIVE,
        lines: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 1000.0,
            subtotal: 1000.0,
            taxRate: 0.0,
            taxAmount: 0.0,
            totalAmount: 1000.0,
          },
        },
      },
    });

    // Yearly sub: ₹12,000/yr -> MRR contribution = 1,000
    await prisma.subscription.create({
      data: {
        subscriptionNumber: 'SUB-2026-80002',
        customerId: customer.id,
        planId: yearlyPlan.id,
        status: SubscriptionStatus.ACTIVE,
        lines: {
          create: {
            productId: product.id,
            quantity: 12,
            unitPrice: 1000.0,
            subtotal: 12000.0,
            taxRate: 0.0,
            taxAmount: 0.0,
            totalAmount: 12000.0,
          },
        },
      },
    });

    // Closed sub (for churn rate calculation)
    await prisma.subscription.create({
      data: {
        subscriptionNumber: 'SUB-2026-80003',
        customerId: customer.id,
        planId: monthlyPlan.id,
        status: SubscriptionStatus.CLOSED,
        lines: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 500.0,
            subtotal: 500.0,
            taxRate: 0.0,
            taxAmount: 0.0,
            totalAmount: 500.0,
          },
        },
      },
    });

    // 6. Create Invoices for Aging Report
    const now = new Date();

    // Current invoice (due in 10 days) -> Balance: ₹500
    const currentDueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-80001',
        subscriptionId: subMonthly.id,
        customerId: customer.id,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: now,
        periodEndDate: currentDueDate,
        dueDate: currentDueDate,
        subtotal: 500.0,
        taxAmount: 0.0,
        totalAmount: 500.0,
        paidAmount: 0.0,
      },
    });

    // Invoice overdue by 15 days -> DAYS_1_30 -> Balance: ₹300
    const overdue15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-80002',
        subscriptionId: subMonthly.id,
        customerId: customer.id,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: overdue15,
        periodEndDate: now,
        dueDate: overdue15,
        subtotal: 300.0,
        taxAmount: 0.0,
        totalAmount: 300.0,
        paidAmount: 0.0,
      },
    });

    // Invoice overdue by 45 days -> DAYS_31_60 -> Balance: ₹400
    const overdue45 = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-80003',
        subscriptionId: subMonthly.id,
        customerId: customer.id,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: overdue45,
        periodEndDate: now,
        dueDate: overdue45,
        subtotal: 400.0,
        taxAmount: 0.0,
        totalAmount: 400.0,
        paidAmount: 0.0,
      },
    });

    // Invoice overdue by 75 days -> DAYS_61_90 -> Balance: ₹600
    const overdue75 = new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000);
    await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-80004',
        subscriptionId: subMonthly.id,
        customerId: customer.id,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: overdue75,
        periodEndDate: now,
        dueDate: overdue75,
        subtotal: 600.0,
        taxAmount: 0.0,
        totalAmount: 600.0,
        paidAmount: 0.0,
      },
    });

    // Invoice overdue by 100 days -> DAYS_90_PLUS -> Balance: ₹700 (Partially paid ₹100, remaining ₹600)
    const overdue100 = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    const inv100 = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-80005',
        subscriptionId: subMonthly.id,
        customerId: customer.id,
        status: InvoiceStatus.PARTIALLY_PAID,
        periodStartDate: overdue100,
        periodEndDate: now,
        dueDate: overdue100,
        subtotal: 700.0,
        taxAmount: 0.0,
        totalAmount: 700.0,
        paidAmount: 100.0,
      },
    });

    // Record Payment Allocation for collected revenue calculation
    const payment = await prisma.payment.create({
      data: {
        paymentNumber: 'PAY-2026-80001',
        customerId: customer.id,
        amount: 100.0,
        method: PaymentMethod.MANUAL_BANK_TRANSFER,
        recordedById: admin.id,
      },
    });

    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceId: inv100.id,
        amount: 100.0,
      },
    });
  });

  afterAll(async () => {
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
  });

  it('rejects analytics access for Customer role with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(403);
  });

  it('allows Staff and Admin to access analytics overview with normalized MRR and ARR', async () => {
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Cookie', staffCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    // Monthly sub = 1,000, Yearly sub = 12,000 / 12 = 1,000 -> Total MRR = 2,000.00
    expect(Number(data.mrr)).toBe(2000.0);
    // ARR = MRR * 12 = 24,000.00
    expect(Number(data.arr)).toBe(24000.0);

    // Total collected = 100.00
    expect(Number(data.totalRevenueCollected)).toBe(100.0);

    // Outstanding AR = 500 (current) + 300 (1-30) + 400 (31-60) + 600 (61-90) + 600 (90+) = 2400.00
    expect(Number(data.outstandingArBalance)).toBe(2400.0);

    // Overdue balance = 300 + 400 + 600 + 600 = 1900.00
    expect(Number(data.overdueBalance)).toBe(1900.0);
    expect(data.overdueInvoicesCount).toBe(4);

    // Subscriptions count & churn rate
    expect(data.activeSubscriptionsCount).toBe(2);
    expect(data.closedSubscriptionsCount).toBe(1);
    expect(data.totalSubscriptionsCount).toBe(3);
    // 1 closed out of 3 total = 33.3%
    expect(data.churnRate).toBe('33.3');
  });

  it('generates accurate Accounts Receivable aging report with bracket categorization', async () => {
    const res = await request(app)
      .get('/api/analytics/aging')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const aging = res.body.data;
    expect(Number(aging.totalOutstanding)).toBe(2400.0);
    expect(Number(aging.totalOverdue)).toBe(1900.0);

    const brackets = aging.brackets;
    const currentBracket = brackets.find((b: { bracket: string }) => b.bracket === 'CURRENT');
    const b1_30 = brackets.find((b: { bracket: string }) => b.bracket === 'DAYS_1_30');
    const b31_60 = brackets.find((b: { bracket: string }) => b.bracket === 'DAYS_31_60');
    const b61_90 = brackets.find((b: { bracket: string }) => b.bracket === 'DAYS_61_90');
    const b90Plus = brackets.find((b: { bracket: string }) => b.bracket === 'DAYS_90_PLUS');

    expect(currentBracket.count).toBe(1);
    expect(Number(currentBracket.totalAmount)).toBe(500.0);

    expect(b1_30.count).toBe(1);
    expect(Number(b1_30.totalAmount)).toBe(300.0);

    expect(b31_60.count).toBe(1);
    expect(Number(b31_60.totalAmount)).toBe(400.0);

    expect(b61_90.count).toBe(1);
    expect(Number(b61_90.totalAmount)).toBe(600.0);

    expect(b90Plus.count).toBe(1);
    expect(Number(b90Plus.totalAmount)).toBe(600.0);

    // Verify overdue invoices list details
    expect(aging.overdueInvoices).toHaveLength(4);
    for (const inv of aging.overdueInvoices) {
      expect(inv.daysOverdue).toBeGreaterThan(0);
      expect(inv.customerName).toBe('Analytics Customer');
    }
  });

  it('returns 6-month historical revenue collection trends', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue-trends')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trends).toHaveLength(6);

    const currentMonthTrend = res.body.data.trends[res.body.data.trends.length - 1];
    expect(currentMonthTrend.month).toMatch(/^\d{4}-\d{2}$/);
    expect(Number(currentMonthTrend.collectedAmount)).toBeGreaterThanOrEqual(100.0);
  });
});
