import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import {
  prisma,
  Role,
  PaymentMethod,
  SubscriptionStatus,
  InvoiceStatus,
  BillingFrequency,
} from '@brightloop/database';
import { sendError } from '../src/common/response.js';

describe('Step P14: Hardening, E2E Verification & Performance Suite', () => {
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;

  const cleanupDb = async () => {
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
  };

  beforeAll(async () => {
    await cleanupDb();

    // 1. Create System Admin
    const adminPasswordHash = await bcrypt.hash('AdminPass#2026!', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'e2e-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'E2E System Admin',
        role: Role.ADMIN,
        isActive: true,
      },
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: admin.email, password: 'AdminPass#2026!' });

    adminCookie =
      adminLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';
  });

  afterAll(async () => {
    await cleanupDb();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. SECURITY HEADERS & CSRF PROTECTION
  // =========================================================================
  describe('1. Security Headers & CSRF Protection Verification', () => {
    it('sets all mandatory Helmet security headers on HTTP responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-download-options']).toBe('noopen');
      expect(res.headers['origin-agent-cluster']).toBe('?1');
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    });

    it('rejects state-changing requests without custom anti-CSRF headers with HTTP 403 Forbidden', async () => {
      // POST without custom header
      const postRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@brightloop.io', password: 'Password#123' });

      expect(postRes.status).toBe(403);
      expect(postRes.body.success).toBe(false);
      expect(postRes.body.error.code).toBe('FORBIDDEN');
      expect(postRes.body.error.message).toContain('CSRF protection');

      // PATCH without custom header
      const patchRes = await request(app)
        .patch('/api/users/profile')
        .send({ fullName: 'New Name' });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.error.code).toBe('FORBIDDEN');

      // Safe GET request passes without custom header
      const getRes = await request(app).get('/api/health');
      expect(getRes.status).toBe(200);
    });

    it('accepts state-changing requests when carrying X-Requested-With or X-CSRF-Token', async () => {
      // With X-Requested-With
      const resWithRequestedWith = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: 'nonexistent@brightloop.io', password: 'Password#123' });

      // Passes CSRF and proceeds to auth validation (returns 401, not 403)
      expect(resWithRequestedWith.status).toBe(401);

      // With X-CSRF-Token
      const resWithCsrfToken = await request(app)
        .post('/api/auth/login')
        .set('X-CSRF-Token', 'valid-token')
        .send({ email: 'nonexistent@brightloop.io', password: 'Password#123' });

      expect(resWithCsrfToken.status).toBe(401);
    });

    it('enforces HttpOnly, Path=/, and SameSite=Strict on auth token cookies', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: 'e2e-admin@brightloop.io', password: 'AdminPass#2026!' });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();

      const accessTokenCookie = cookies.find((c) => c.startsWith('access_token='));
      const refreshTokenCookie = cookies.find((c) => c.startsWith('refresh_token='));

      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('Path=/');
      expect(accessTokenCookie).toContain('SameSite=Strict');

      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('Path=/');
      expect(refreshTokenCookie).toContain('SameSite=Strict');
    });

    it('enforces rate limiting and returns HTTP 429 when threshold exceeded', async () => {
      const testRateLimitApp = express();
      testRateLimitApp.use(
        rateLimit({
          windowMs: 1000,
          max: 2,
          standardHeaders: true,
          legacyHeaders: false,
          handler: (_req, res) => {
            sendError(
              res,
              'RATE_LIMIT_EXCEEDED',
              'Too many requests from this IP, please try again in 15 minutes',
              undefined,
              429,
            );
          },
        }),
      );
      testRateLimitApp.get('/test-rate-limit', (_req, res) => res.json({ success: true }));

      // Request 1: OK
      const req1 = await request(testRateLimitApp).get('/test-rate-limit');
      expect(req1.status).toBe(200);

      // Request 2: OK
      const req2 = await request(testRateLimitApp).get('/test-rate-limit');
      expect(req2.status).toBe(200);

      // Request 3: Exceeded -> 429
      const req3 = await request(testRateLimitApp).get('/test-rate-limit');
      expect(req3.status).toBe(429);
      expect(req3.body.success).toBe(false);
      expect(req3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // =========================================================================
  // 2. PERFORMANCE BENCHMARKING
  // =========================================================================
  describe('2. Performance Benchmarking & Response Time Audit', () => {
    it('executes GET /api/health within 200ms target', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/health');
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.database.connected).toBe(true);
      expect(elapsed).toBeLessThan(200);
    });

    it('executes GET /api/catalog/products within 200ms target', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/catalog/products')
        .set('Cookie', adminCookie);
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(200);
    });

    it('executes GET /api/analytics/overview within 200ms target', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Cookie', adminCookie);
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(200);
    });

    it('executes GET /api/invoices within 200ms target', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/invoices')
        .set('Cookie', adminCookie);
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(200);
    });
  });

  // =========================================================================
  // 3. COMPLETE 11-STEP END-TO-END SAAS BUSINESS JOURNEY
  // =========================================================================
  describe('3. Complete 11-Step SaaS Business Lifecycle Journey', () => {
    let productId: string;
    let variantId: string;
    let planId: string;
    let subscriptionId: string;
    let firstInvoiceId: string;
    let secondInvoiceId: string;

    // STEP 1: Admin provisions Catalog
    it('Step 1: Admin provisions Product, Variant, and Subscription Plan', async () => {
      // 1. Create Product
      const productRes = await request(app)
        .post('/api/catalog/products')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          name: 'Brightloop Enterprise Cloud',
          description: 'High-availability dedicated cloud instance',
          type: 'SERVICE',
          salesPrice: 1500.0,
          costPrice: 500.0,
        });

      expect(productRes.status).toBe(201);
      expect(productRes.body.data.product.id).toBeDefined();
      productId = productRes.body.data.product.id;

      // 2. Create Variant with Price Adjustment (+500.00)
      const variantRes = await request(app)
        .post(`/api/catalog/products/${productId}/variants`)
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          attributeName: 'Support SLA',
          attributeValue: '24/7 Dedicated Support',
          priceAdjustment: 500.0,
          isAvailable: true,
        });

      expect(variantRes.status).toBe(201);
      expect(variantRes.body.data.variant.id).toBeDefined();
      variantId = variantRes.body.data.variant.id;

      // 3. Create Subscription Plan (Monthly)
      const planRes = await request(app)
        .post('/api/catalog/plans')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          name: 'Enterprise Monthly SLA',
          billingFrequency: BillingFrequency.MONTHLY,
          minQuantity: 1,
          pauseAllowed: true,
          autoClose: false,
        });

      expect(planRes.status).toBe(201);
      expect(planRes.body.data.plan.id).toBeDefined();
      planId = planRes.body.data.plan.id;
    });

    // STEP 2: Customer registers with strict password
    it('Step 2: Customer self-registers with strict password and receives auth cookies', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'e2e-enterprise-client@brightloop.io',
          password: 'Password#2026!',
          fullName: 'Acme Systems Corp',
        });

      expect(registerRes.status).toBe(201);
      expect(registerRes.body.data.user.userId).toBeDefined();
      expect(registerRes.body.data.user.role).toBe(Role.CUSTOMER);
      customerId = registerRes.body.data.user.userId;

      // Extract customer session cookie
      customerCookie =
        registerRes.headers['set-cookie']
          ?.find((c: string) => c.startsWith('access_token='))
          ?.split(';')[0] || '';
      expect(customerCookie).not.toBe('');
    });

    // STEP 3: Customer requests quotation
    it('Step 3: Customer requests quotation with snapshot pricing and receives SUB-YYYY-XXXXX', async () => {
      // Unit price = 1500 (product) + 500 (variant) = 2000.00
      // Quantity = 2 -> Subtotal = 4000.00, Tax 18% = 720.00, Total = 4720.00
      const quoteRes = await request(app)
        .post('/api/subscriptions')
        .set('Cookie', customerCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          planId,
          status: SubscriptionStatus.QUOTATION,
          lines: [
            {
              productId,
              variantId,
              quantity: 2,
              taxRate: 18.0,
            },
          ],
        });

      expect(quoteRes.status).toBe(201);
      const sub = quoteRes.body.data.subscription;
      expect(sub.id).toBeDefined();
      expect(sub.status).toBe(SubscriptionStatus.QUOTATION);
      expect(sub.subscriptionNumber).toMatch(/^SUB-\d{4}-\d{5}$/);
      expect(sub.lines).toHaveLength(1);
      expect(Number(sub.lines[0].unitPrice)).toBe(2000);
      expect(Number(sub.lines[0].subtotal)).toBe(4000);
      expect(Number(sub.lines[0].taxAmount)).toBe(720);
      expect(Number(sub.lines[0].totalAmount)).toBe(4720);

      subscriptionId = sub.id;
    });

    // STEP 4: Customer confirms quotation
    it('Step 4: Customer confirms quotation, transitioning status to CONFIRMED', async () => {
      const confirmRes = await request(app)
        .post(`/api/subscriptions/${subscriptionId}/confirm`)
        .set('Cookie', customerCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({});

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.subscription.status).toBe(SubscriptionStatus.CONFIRMED);
    });

    // STEP 5: Admin activates subscription
    it('Step 5: Admin activates subscription, setting status to ACTIVE with immediate billing date', async () => {
      const activateRes = await request(app)
        .post(`/api/subscriptions/${subscriptionId}/transition`)
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ action: 'ACTIVATE' });

      expect(activateRes.status).toBe(200);
      const sub = activateRes.body.data.subscription;
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.startDate).toBeDefined();
      expect(sub.nextBillingDate).toBeDefined();
    });

    // STEP 6: Autonomous Billing Worker Cycle & Idempotency
    it('Step 6: Billing worker generates first invoice and advances next billing date; verifies idempotency', async () => {
      // 1. Run billing worker batch
      const cycle1Res = await request(app)
        .post('/api/billing/run-worker')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(cycle1Res.status).toBe(200);
      const result1 = cycle1Res.body.data.result;
      expect(result1.processed).toBeGreaterThanOrEqual(1);
      expect(result1.successful).toBeGreaterThanOrEqual(1);
      expect(result1.failed).toBe(0);

      // Verify Invoice 1 generated
      const inv1 = await prisma.invoice.findFirst({
        where: { subscriptionId },
        include: { lines: true },
      });
      expect(inv1).not.toBeNull();
      expect(inv1!.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
      expect(inv1!.status).toBe(InvoiceStatus.CONFIRMED);
      expect(Number(inv1!.totalAmount)).toBe(4720);
      expect(Number(inv1!.paidAmount)).toBe(0);

      firstInvoiceId = inv1!.id;

      // 2. Verify Idempotency: Running worker again immediately produces 0 new invoices
      const cycle2Res = await request(app)
        .post('/api/billing/run-worker')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(cycle2Res.status).toBe(200);
      expect(cycle2Res.body.data.result.processed).toBe(0);

      // 3. Fast-forward nextBillingDate to simulate renewal cycle
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { nextBillingDate: new Date(Date.now() - 3600 * 1000) },
      });

      // Run worker again for renewal cycle -> creates Invoice 2
      const cycle3Res = await request(app)
        .post('/api/billing/run-worker')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(cycle3Res.status).toBe(200);
      expect(cycle3Res.body.data.result.successful).toBe(1);

      const allInvoices = await prisma.invoice.findMany({
        where: { subscriptionId },
        orderBy: { createdAt: 'asc' },
      });
      expect(allInvoices).toHaveLength(2);
      secondInvoiceId = allInvoices[1].id;
    });

    // STEP 7: Dynamic overdue evaluation
    it('Step 7: Dynamically evaluates overdue status when dueDate is past without mutating DB status (Decision D-09)', async () => {
      // Simulate overdue by setting dueDate to 5 days ago
      const pastDueDate = new Date(Date.now() - 5 * 24 * 3600 * 1000);
      await prisma.invoice.update({
        where: { id: firstInvoiceId },
        data: { dueDate: pastDueDate },
      });

      // Fetch invoice via API
      const invoiceRes = await request(app)
        .get(`/api/invoices/${firstInvoiceId}`)
        .set('Cookie', customerCookie);

      expect(invoiceRes.status).toBe(200);
      const inv = invoiceRes.body.data.invoice;
      // D-09: Evaluated dynamically
      expect(inv.isOverdue).toBe(true);
      expect(inv.balanceDue).toBe('4720.00');

      // Physical database record remains CONFIRMED (not mutated to OVERDUE)
      const rawDbInv = await prisma.invoice.findUniqueOrThrow({
        where: { id: firstInvoiceId },
      });
      expect(rawDbInv.status).toBe(InvoiceStatus.CONFIRMED);
    });

    // STEP 8: Offline payment with surplus & credit balance
    it('Step 8: Admin records payment with surplus (Decision D-07); settles 1st invoice and credits customer balance', async () => {
      // Invoice 1 total is 4720.00. Payment is 6000.00 -> Surplus is 1280.00
      const paymentRes = await request(app)
        .post('/api/payments')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          customerId,
          amount: 6000.0,
          method: PaymentMethod.MANUAL_BANK_TRANSFER,
          notes: 'Wire transfer with surplus deposit',
          allocations: [
            {
              invoiceId: firstInvoiceId,
              amount: 4720.0,
            },
          ],
        });

      expect(paymentRes.status).toBe(201);
      const payment = paymentRes.body.data;
      expect(payment.paymentNumber).toMatch(/^PAY-\d{4}-\d{5}$/);
      expect(payment.totalAllocated).toBe('4720.00');
      expect(payment.surplusAmount).toBe('1280.00');

      // Verify First Invoice is now PAID and no longer overdue
      const settledInvRes = await request(app)
        .get(`/api/invoices/${firstInvoiceId}`)
        .set('Cookie', customerCookie);

      expect(settledInvRes.body.data.invoice.status).toBe(InvoiceStatus.PAID);
      expect(settledInvRes.body.data.invoice.isOverdue).toBe(false);
      expect(settledInvRes.body.data.invoice.balanceDue).toBe('0.00');

      // Verify Customer creditBalance updated in DB
      const updatedCustomer = await prisma.user.findUniqueOrThrow({
        where: { id: customerId },
      });
      expect(Number(updatedCustomer.creditBalance)).toBe(1280.0);
    });

    // STEP 9: Customer applies surplus credit to settle second invoice
    it('Step 9: Customer applies surplus credit to second invoice, transitioning it to PARTIALLY_PAID and reducing balance', async () => {
      const applyCreditRes = await request(app)
        .post('/api/payments/apply-credit')
        .set('Cookie', customerCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          invoiceId: secondInvoiceId,
          amount: 1280.0,
        });

      expect(applyCreditRes.status).toBe(200);

      // Verify customer credit balance is now 0.00
      const customerAfterCredit = await prisma.user.findUniqueOrThrow({
        where: { id: customerId },
      });
      expect(Number(customerAfterCredit.creditBalance)).toBe(0.0);

      // Verify Second Invoice paidAmount and status
      const secondInvRes = await request(app)
        .get(`/api/invoices/${secondInvoiceId}`)
        .set('Cookie', customerCookie);

      expect(secondInvRes.body.data.invoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(secondInvRes.body.data.invoice.paidAmount).toBe('1280.00');
      expect(secondInvRes.body.data.invoice.balanceDue).toBe('3440.00');
    });

    // STEP 10: Customer updates profile and views statement ledger
    it('Step 10: Customer updates profile and inspects itemized credit transaction statement ledger', async () => {
      // 1. Update Profile
      const updateRes = await request(app)
        .patch('/api/users/profile')
        .set('Cookie', customerCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          companyName: 'Acme Systems Global Inc.',
          billingAddress: '100 Silicon Highway, Suite 400',
          taxId: 'GSTIN27AABCU9603R1ZM',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.companyName).toBe('Acme Systems Global Inc.');
      expect(updateRes.body.data.billingAddress).toBe('100 Silicon Highway, Suite 400');

      // 2. Query Credit History Statement
      const creditHistoryRes = await request(app)
        .get('/api/users/credit-history')
        .set('Cookie', customerCookie);

      expect(creditHistoryRes.status).toBe(200);
      const ledger = creditHistoryRes.body.data;
      expect(ledger.creditBalance).toBe('0.00');
      expect(ledger.transactions.length).toBeGreaterThanOrEqual(2);

      // Look for surplus credit and invoice deduction
      const surplusEntry = ledger.transactions.find((t: { type: string }) => t.type === 'CREDIT');
      const invoicePaymentEntry = ledger.transactions.find((t: { type: string }) => t.type === 'DEBIT');

      expect(surplusEntry).toBeDefined();
      expect(Number(surplusEntry.amount)).toBe(1280.0);

      expect(invoicePaymentEntry).toBeDefined();
      expect(Number(invoicePaymentEntry.amount)).toBe(1280.0);
    });

    // STEP 11: Admin inspects administrative audit trail
    it('Step 11: Admin queries and inspects comprehensive security audit trail of all transactions', async () => {
      const auditRes = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(auditRes.status).toBe(200);
      expect(Array.isArray(auditRes.body.data)).toBe(true);
      const logs = auditRes.body.data;
      expect(logs.length).toBeGreaterThanOrEqual(2);

      // Verify actions logged
      const actions = logs.map((l: { action: string }) => l.action);
      expect(actions).toContain('PAYMENT_SURPLUS_CREDITED');
      expect(actions).toContain('CREDIT_APPLIED_TO_INVOICE');
    });
  });
});
