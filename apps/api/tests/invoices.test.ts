import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role, BillingFrequency, SubscriptionStatus, InvoiceStatus } from '@brightloop/database';

describe('Invoicing Engine & PDF Export Module', () => {
  let adminCookie: string;
  let customerACookie: string;
  let customerBCookie: string;
  let customerAId: string;

  let overdueInvoiceId: string;
  let futureInvoiceId: string;

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
        email: 'inv-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Invoice Admin',
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
        email: 'inv-cust-a@brightloop.io',
        passwordHash: customerAPasswordHash,
        fullName: 'Customer Acme Inc',
        companyName: 'Acme Systems',
        taxId: '27AABCU9603R1ZM',
        billingAddress: '42 Tech Park, Bangalore',
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
        email: 'inv-cust-b@brightloop.io',
        passwordHash: customerBPasswordHash,
        fullName: 'Customer Beta Corp',
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

    // 4. Create Plan & Product
    const plan = await prisma.plan.create({
      data: {
        name: 'Enterprise Monthly Cloud',
        billingFrequency: BillingFrequency.MONTHLY,
        minQuantity: 1,
        isActive: true,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'SaaS Platform Core',
        salesPrice: 2000.0,
        costPrice: 400.0,
        isAvailable: true,
      },
    });

    const sub = await prisma.subscription.create({
      data: {
        subscriptionNumber: 'SUB-2026-88001',
        customerId: customerAId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    // 5. Seed Overdue Invoice (dueDate was 5 days ago)
    const pastDueDate = new Date(Date.now() - 5 * 24 * 3600 * 1000);
    const overdueInv = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-88001',
        subscriptionId: sub.id,
        customerId: customerAId,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: new Date(Date.now() - 35 * 24 * 3600 * 1000),
        periodEndDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
        dueDate: pastDueDate,
        subtotal: 2000.0,
        taxAmount: 360.0,
        totalAmount: 2360.0,
        paidAmount: 0.0,
        lines: {
          create: [
            {
              productId: product.id,
              description: 'SaaS Platform Core Monthly License',
              quantity: 1,
              unitPrice: 2000.0,
              subtotal: 2000.0,
              taxRate: 18.0,
              taxAmount: 360.0,
              totalAmount: 2360.0,
            },
          ],
        },
      },
    });
    overdueInvoiceId = overdueInv.id;

    // 6. Seed Future Invoice (dueDate in 15 days)
    const futureDueDate = new Date(Date.now() + 15 * 24 * 3600 * 1000);
    const futureInv = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-88002',
        subscriptionId: sub.id,
        customerId: customerAId,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: new Date(),
        periodEndDate: futureDueDate,
        dueDate: futureDueDate,
        subtotal: 2000.0,
        taxAmount: 360.0,
        totalAmount: 2360.0,
        paidAmount: 0.0,
        lines: {
          create: [
            {
              productId: product.id,
              description: 'SaaS Platform Core Monthly License',
              quantity: 1,
              unitPrice: 2000.0,
              subtotal: 2000.0,
              taxRate: 18.0,
              taxAmount: 360.0,
              totalAmount: 2360.0,
            },
          ],
        },
      },
    });
    futureInvoiceId = futureInv.id;
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

  describe('Dynamic Overdue & Balance Due Computation (Decision D-09)', () => {
    it('accurately computes derived isOverdue: true for past dueDate and false for future dueDate', async () => {
      const overdueRes = await request(app)
        .get(`/api/invoices/${overdueInvoiceId}`)
        .set('Cookie', adminCookie);

      expect(overdueRes.status).toBe(200);
      expect(overdueRes.body.data.invoice.isOverdue).toBe(true);
      expect(overdueRes.body.data.invoice.balanceDue).toBe('2360.00');

      const futureRes = await request(app)
        .get(`/api/invoices/${futureInvoiceId}`)
        .set('Cookie', adminCookie);

      expect(futureRes.status).toBe(200);
      expect(futureRes.body.data.invoice.isOverdue).toBe(false);
      expect(futureRes.body.data.invoice.balanceDue).toBe('2360.00');
    });

    it('filters exclusively overdue invoices when ?isOverdue=true is queried', async () => {
      const res = await request(app)
        .get('/api/invoices?isOverdue=true')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.invoices).toHaveLength(1);
      expect(res.body.data.invoices[0].id).toBe(overdueInvoiceId);
    });
  });

  describe('Security & IDOR Isolation', () => {
    it('Customer B attempting to read Customer A invoice receives 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/invoices/${overdueInvoiceId}`)
        .set('Cookie', customerBCookie);

      expect(res.status).toBe(404);
    });

    it('Customer B attempting to print Customer A invoice receives 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/invoices/${overdueInvoiceId}/print`)
        .set('Cookie', customerBCookie);

      expect(res.status).toBe(404);
    });

    it('Customer querying /api/invoices only sees their own invoices', async () => {
      const res = await request(app)
        .get('/api/invoices')
        .set('Cookie', customerBCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.invoices).toHaveLength(0);
    });
  });

  describe('Admin Voiding / Cancellation', () => {
    it('rejects invoice cancellation when attempted by Customer with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/invoices/${futureInvoiceId}/cancel`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerACookie)
        .send({ reason: 'Customer wants to cancel' });

      expect(res.status).toBe(403);
    });

    it('allows Admin to cancel an unpaid invoice', async () => {
      const res = await request(app)
        .post(`/api/invoices/${futureInvoiceId}/cancel`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ reason: 'Billing schedule adjustment' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoice.status).toBe('CANCELLED');

      const dbInv = await prisma.invoice.findUnique({
        where: { id: futureInvoiceId },
      });
      expect(dbInv?.status).toBe('CANCELLED');
    });

    it('rejects cancelling an already cancelled invoice with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/invoices/${futureInvoiceId}/cancel`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({ reason: 'Try again' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already CANCELLED');
    });
  });

  describe('Printable HTML & PDF Ready Export', () => {
    it('serves clean HTML formatted tax invoice on /api/invoices/:id/print with text/html header', async () => {
      const res = await request(app)
        .get(`/api/invoices/${overdueInvoiceId}/print`)
        .set('Cookie', customerACookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('INV-2026-88001');
      expect(res.text).toContain('BRIGHTLOOP SOFTWARE');
      expect(res.text).toContain('Customer Acme Inc');
      expect(res.text).toContain('27AABCU9603R1ZM');
      expect(res.text).toContain('SaaS Platform Core Monthly License');
      expect(res.text).toContain('2360.00');
      expect(res.text).toContain('@media print');
    });
  });
});
