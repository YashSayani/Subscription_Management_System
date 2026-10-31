import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role, BillingFrequency, SubscriptionStatus } from '@brightloop/database';

describe('Quotations & Subscriptions Lifecycle Module', () => {
  let adminCookie: string;
  let customerACookie: string;
  let customerBCookie: string;
  let customerAId: string;

  let testPlanId: string;
  let noPausePlanId: string;
  let testProductId: string;
  let testVariantId: string;

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
        email: 'sub-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Subscription Admin',
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

    // 2. Create Customer A
    const customerAPasswordHash = await bcrypt.hash('CustomerPass#123', 12);
    const customerA = await prisma.user.create({
      data: {
        email: 'sub-cust-a@brightloop.io',
        passwordHash: customerAPasswordHash,
        fullName: 'Customer Alpha',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });
    customerAId = customerA.id;

    const customerALogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: customerA.email, password: 'CustomerPass#123' });
    customerACookie =
      customerALogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 3. Create Customer B (for IDOR tests)
    const customerBPasswordHash = await bcrypt.hash('CustomerPass#123', 12);
    const customerB = await prisma.user.create({
      data: {
        email: 'sub-cust-b@brightloop.io',
        passwordHash: customerBPasswordHash,
        fullName: 'Customer Beta',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });

    const customerBLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: customerB.email, password: 'CustomerPass#123' });
    customerBCookie =
      customerBLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 4. Create Plans
    const plan = await prisma.plan.create({
      data: {
        name: 'Standard Monthly Cloud Plan',
        billingFrequency: BillingFrequency.MONTHLY,
        minQuantity: 1,
        pauseAllowed: true,
        isActive: true,
      },
    });
    testPlanId = plan.id;

    const noPausePlan = await prisma.plan.create({
      data: {
        name: 'Annual Enterprise (No Pause)',
        billingFrequency: BillingFrequency.YEARLY,
        minQuantity: 1,
        pauseAllowed: false,
        isActive: true,
      },
    });
    noPausePlanId = noPausePlan.id;

    // 5. Create Product with Variant
    const product = await prisma.product.create({
      data: {
        name: 'Brightloop Analytics Suite',
        salesPrice: 2000.0,
        costPrice: 500.0,
        isAvailable: true,
        variants: {
          create: [
            {
              attributeName: 'Brand',
              attributeValue: 'Odoo',
              priceAdjustment: 560.0,
              isAvailable: true,
            },
          ],
        },
      },
      include: { variants: true },
    });
    testProductId = product.id;
    testVariantId = product.variants[0].id;
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
    await prisma.$disconnect();
  });

  describe('Unified Model, Sequence Numbers & Price Snapshotting', () => {
    let createdQuoteId: string;

    it('creates a quotation with unique SUB-YYYY-XXXXX sequence number and snapshot pricing', async () => {
      // Unit price: 2000 + 560 = 2560. Qty 2 -> Subtotal = 5120. Tax 18% = 921.60. Total = 6041.60
      const res = await request(app)
        .post('/api/subscriptions')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerACookie)
        .send({
          planId: testPlanId,
          status: SubscriptionStatus.QUOTATION,
          paymentTermsDays: 15,
          lines: [
            {
              productId: testProductId,
              variantId: testVariantId,
              quantity: 2,
              taxRate: 18.0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const sub = res.body.data.subscription;
      expect(sub.subscriptionNumber).toMatch(/^SUB-\d{4}-\d{5}$/);
      expect(sub.status).toBe('QUOTATION');
      expect(sub.customerId).toBe(customerAId);
      expect(sub.lines).toHaveLength(1);

      const line = sub.lines[0];
      expect(Number(line.unitPrice)).toBe(2560.0);
      expect(Number(line.subtotal)).toBe(5120.0);
      expect(Number(line.taxAmount)).toBe(921.6);
      expect(Number(line.totalAmount)).toBe(6041.6);

      createdQuoteId = sub.id;
    });

    it('preserves immutable price snapshot on subscription even if catalog product price increases', async () => {
      // Change catalog product price from 2000 to 3500
      await prisma.product.update({
        where: { id: testProductId },
        data: { salesPrice: 3500.0 },
      });

      // Existing quote must retain exact original snapshot price (2560.00 unit, 6041.60 total)
      const res = await request(app)
        .get(`/api/subscriptions/${createdQuoteId}`)
        .set('Cookie', customerACookie);

      expect(res.status).toBe(200);
      const sub = res.body.data.subscription;
      expect(Number(sub.lines[0].unitPrice)).toBe(2560.0);
      expect(Number(sub.lines[0].totalAmount)).toBe(6041.6);
    });
  });

  describe('State Machine Transitions & Enforcements', () => {
    let lifecycleSubId: string;

    beforeAll(async () => {
      // Create fresh quotation for Customer A
      const res = await request(app)
        .post('/api/subscriptions')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerACookie)
        .send({
          planId: testPlanId,
          status: SubscriptionStatus.QUOTATION,
          lines: [{ productId: testProductId, quantity: 1 }],
        });
      lifecycleSubId = res.body.data.subscription.id;
    });

    it('rejects illegal transition: activating a QUOTATION without confirmation returns 400', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${lifecycleSubId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ action: 'ACTIVATE' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('Customer confirms their quotation: transitions QUOTATION -> CONFIRMED', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${lifecycleSubId}/confirm`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerACookie);

      expect(res.status).toBe(200);
      expect(res.body.data.subscription.status).toBe('CONFIRMED');
    });

    it('Admin activates confirmed subscription: transitions CONFIRMED -> ACTIVE with start date and billing date set', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${lifecycleSubId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ action: 'ACTIVATE' });

      expect(res.status).toBe(200);
      const sub = res.body.data.subscription;
      expect(sub.status).toBe('ACTIVE');
      expect(sub.startDate).not.toBeNull();
      expect(sub.nextBillingDate).not.toBeNull();
    });

    it('Admin pauses active subscription: transitions ACTIVE -> PAUSED with pausedAt timestamp', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${lifecycleSubId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ action: 'PAUSE' });

      expect(res.status).toBe(200);
      const sub = res.body.data.subscription;
      expect(sub.status).toBe('PAUSED');
      expect(sub.pausedAt).not.toBeNull();
    });

    it('Admin resumes paused subscription (Decision D-05: no retroactive backfill): sets nextBillingDate to now', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${lifecycleSubId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ action: 'RESUME' });

      expect(res.status).toBe(200);
      const sub = res.body.data.subscription;
      expect(sub.status).toBe('ACTIVE');
      expect(sub.pausedAt).toBeNull();
      expect(sub.nextBillingDate).not.toBeNull();
    });

    it('Admin terminates subscription early (Decision D-06): transitions ACTIVE -> CLOSED with closedAt set', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${lifecycleSubId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ action: 'CLOSE' });

      expect(res.status).toBe(200);
      const sub = res.body.data.subscription;
      expect(sub.status).toBe('CLOSED');
      expect(sub.closedAt).not.toBeNull();
    });

    it('rejects any transition on a CLOSED subscription: returns 400', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${lifecycleSubId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ action: 'PAUSE' });

      expect(res.status).toBe(400);
    });

    it('rejects pausing on a plan that forbids pausing', async () => {
      // Create & activate subscription on noPausePlan
      const createRes = await request(app)
        .post('/api/subscriptions')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          customerId: customerAId,
          planId: noPausePlanId,
          status: SubscriptionStatus.QUOTATION,
          lines: [{ productId: testProductId, quantity: 1 }],
        });
      const noPauseSubId = createRes.body.data.subscription.id;

      await request(app)
        .post(`/api/subscriptions/${noPauseSubId}/confirm`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);

      await request(app)
        .post(`/api/subscriptions/${noPauseSubId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ action: 'ACTIVATE' });

      // Attempting pause must fail
      const pauseRes = await request(app)
        .post(`/api/subscriptions/${noPauseSubId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ action: 'PAUSE' });

      expect(pauseRes.status).toBe(400);
      expect(pauseRes.body.error.message).toContain('do not permit pausing');
    });
  });

  describe('IDOR & Security Protection (Customer Isolation)', () => {
    let customerAQuoteId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/subscriptions')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerACookie)
        .send({
          planId: testPlanId,
          status: SubscriptionStatus.QUOTATION,
          lines: [{ productId: testProductId, quantity: 1 }],
        });
      customerAQuoteId = res.body.data.subscription.id;
    });

    it('Customer B attempting to inspect Customer A quotation receives 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/subscriptions/${customerAQuoteId}`)
        .set('Cookie', customerBCookie);

      expect(res.status).toBe(404);
    });

    it('Customer B attempting to confirm Customer A quotation receives 404 Not Found', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${customerAQuoteId}/confirm`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerBCookie);

      expect(res.status).toBe(404);
    });

    it('Customer A cannot unauthorizedly pause subscription without Staff/Admin role', async () => {
      const res = await request(app)
        .post(`/api/subscriptions/${customerAQuoteId}/transition`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerACookie)
        .send({ action: 'PAUSE' });

      expect(res.status).toBe(403);
    });
  });
});
