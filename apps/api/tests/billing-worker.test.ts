import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role, BillingFrequency, SubscriptionStatus, InvoiceStatus } from '@brightloop/database';
import { BillingEngine } from '../src/modules/billing/engine.js';

describe('Idempotent Billing Worker Module', () => {
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;
  let testPlanId: string;
  let testProductId: string;

  beforeAll(async () => {
    // Clean up
    await prisma.billingAttempt.deleteMany();
    await prisma.paymentAllocation.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create Admin
    const adminPasswordHash = await bcrypt.hash('AdminPass#123', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'billing-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Billing Admin',
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

    // 2. Create Customer
    const customerPasswordHash = await bcrypt.hash('CustomerPass#123', 12);
    const customer = await prisma.user.create({
      data: {
        email: 'billing-customer@brightloop.io',
        passwordHash: customerPasswordHash,
        fullName: 'Billing Customer',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });
    customerId = customer.id;

    const customerLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: customer.email, password: 'CustomerPass#123' });
    customerCookie =
      customerLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 3. Create Monthly Plan
    const plan = await prisma.plan.create({
      data: {
        name: 'SaaS Monthly Professional',
        billingFrequency: BillingFrequency.MONTHLY,
        minQuantity: 1,
        pauseAllowed: true,
        isActive: true,
      },
    });
    testPlanId = plan.id;

    // 4. Create Product
    const product = await prisma.product.create({
      data: {
        name: 'Cloud Infrastructure Service',
        salesPrice: 1000.0,
        costPrice: 200.0,
        isAvailable: true,
      },
    });
    testProductId = product.id;
  });

  afterAll(async () => {
    await prisma.billingAttempt.deleteMany();
    await prisma.paymentAllocation.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('Autonomous Billing Execution & Invoice Generation', () => {
    let testSubId: string;
    let initialBillingDate: Date;

    beforeAll(async () => {
      // Due date set to 2 hours ago
      initialBillingDate = new Date(Date.now() - 2 * 3600 * 1000);

      const sub = await prisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-2026-99001',
          customerId,
          planId: testPlanId,
          status: SubscriptionStatus.ACTIVE,
          startDate: initialBillingDate,
          nextBillingDate: initialBillingDate,
          paymentTermsDays: 15,
          lines: {
            create: [
              {
                productId: testProductId,
                quantity: 2,
                unitPrice: 1000.0,
                variantAdjustment: 0.0,
                taxRate: 18.0,
                subtotal: 2000.0,
                taxAmount: 360.0,
                totalAmount: 2360.0,
              },
            ],
          },
        },
      });
      testSubId = sub.id;
    });

    it('picks up due active subscription, generates sequence invoice, advances next billing date, and logs BillingAttempt', async () => {
      const cycleResult = await BillingEngine.runBillingCycle();

      expect(cycleResult.processed).toBeGreaterThanOrEqual(1);
      expect(cycleResult.successful).toBeGreaterThanOrEqual(1);
      expect(cycleResult.failed).toBe(0);

      // Verify Invoice generated in DB
      const invoice = await prisma.invoice.findFirst({
        where: { subscriptionId: testSubId },
        include: { lines: true, billingAttempts: true },
      });

      expect(invoice).not.toBeNull();
      expect(invoice?.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
      expect(invoice?.status).toBe(InvoiceStatus.CONFIRMED);
      expect(Number(invoice?.subtotal)).toBe(2000.0);
      expect(Number(invoice?.taxAmount)).toBe(360.0);
      expect(Number(invoice?.totalAmount)).toBe(2360.0);
      expect(Number(invoice?.paidAmount)).toBe(0.0);
      expect(invoice?.lines).toHaveLength(1);
      expect(invoice?.lines[0].description).toContain('Cloud Infrastructure Service');
      expect(Number(invoice?.lines[0].totalAmount)).toBe(2360.0);

      // Verify Subscription next_billing_date has advanced (by approx 1 month)
      const updatedSub = await prisma.subscription.findUnique({
        where: { id: testSubId },
      });
      expect(updatedSub?.nextBillingDate).not.toBeNull();
      expect(updatedSub!.nextBillingDate!.getTime()).toBeGreaterThan(initialBillingDate.getTime());

      // Verify BillingAttempt logged
      const attempt = await prisma.billingAttempt.findFirst({
        where: { subscriptionId: testSubId },
      });
      expect(attempt).not.toBeNull();
      expect(attempt?.status).toBe('SUCCESS');
      expect(attempt?.invoiceId).toBe(invoice?.id);
    });

    it('second immediate run generates 0 duplicate invoices (idempotency guard)', async () => {
      const cycleResult = await BillingEngine.runBillingCycle();

      expect(cycleResult.processed).toBe(0);
      expect(cycleResult.successful).toBe(0);

      const totalInvoices = await prisma.invoice.count({
        where: { subscriptionId: testSubId },
      });
      expect(totalInvoices).toBe(1);
    });

    it('concurrent worker execution (race condition test) produces exactly 1 invoice and 0 duplicate records', async () => {
      // Create second subscription due right now
      const dueNow = new Date(Date.now() - 3600 * 1000);
      const sub2 = await prisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-2026-99002',
          customerId,
          planId: testPlanId,
          status: SubscriptionStatus.ACTIVE,
          startDate: dueNow,
          nextBillingDate: dueNow,
          lines: {
            create: [
              {
                productId: testProductId,
                quantity: 1,
                unitPrice: 1000.0,
                subtotal: 1000.0,
                taxRate: 18.0,
                taxAmount: 180.0,
                totalAmount: 1180.0,
              },
            ],
          },
        },
      });

      // Simulate 2 worker processes racing concurrently
      const [res1, res2] = await Promise.all([
        BillingEngine.runBillingCycle(10),
        BillingEngine.runBillingCycle(10),
      ]);

      const totalSuccess = res1.successful + res2.successful;
      expect(totalSuccess).toBe(1);

      // Verify database contains strictly 1 invoice for this subscription
      const invoiceCount = await prisma.invoice.count({
        where: { subscriptionId: sub2.id },
      });
      expect(invoiceCount).toBe(1);
    });
  });

  describe('Admin On-Demand Worker Endpoint & RBAC', () => {
    it('rejects trigger attempt by unauthenticated or customer request with 401/403', async () => {
      const res = await request(app)
        .post('/api/billing/run-worker')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(403);
    });

    it('allows Admin to trigger billing worker on-demand', async () => {
      const res = await request(app)
        .post('/api/billing/run-worker')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.result).toHaveProperty('processed');
    });

    it('allows Admin to view billing execution attempts', async () => {
      const res = await request(app)
        .get('/api/billing/attempts')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.attempts)).toBe(true);
    });
  });
});
