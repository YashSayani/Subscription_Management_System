import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role, BillingFrequency, PaymentMethod, InvoiceStatus } from '@brightloop/database';

describe('Customer Self-Service Portal Module', () => {
  let adminCookie: string;
  let staffCookie: string;
  let customer1Cookie: string;

  let customer1Id: string;
  let customer2Id: string;

  beforeAll(async () => {
    // Clean up database tables
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
        email: 'portal-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Portal Admin',
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
        email: 'portal-staff@brightloop.io',
        passwordHash: staffPasswordHash,
        fullName: 'Portal Staff',
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

    // 3. Create Customer 1
    const cust1PasswordHash = await bcrypt.hash('CustPass#123', 12);
    const cust1 = await prisma.user.create({
      data: {
        email: 'customer1@brightloop.io',
        passwordHash: cust1PasswordHash,
        fullName: 'Alice Walker',
        companyName: 'Walker Industries',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });
    customer1Id = cust1.id;

    const cust1Login = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: cust1.email, password: 'CustPass#123' });
    customer1Cookie =
      cust1Login.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 4. Create Customer 2
    const cust2PasswordHash = await bcrypt.hash('CustPass#123', 12);
    const cust2 = await prisma.user.create({
      data: {
        email: 'customer2@brightloop.io',
        passwordHash: cust2PasswordHash,
        fullName: 'Bob Builder',
        companyName: 'Builder Corp',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });
    customer2Id = cust2.id;
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

  describe('1. Profile Retrieval & Updates', () => {
    it('rejects unauthenticated request to /api/users/profile', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('retrieves customer profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(customer1Id);
      expect(res.body.data.email).toBe('customer1@brightloop.io');
      expect(res.body.data.fullName).toBe('Alice Walker');
      expect(res.body.data.companyName).toBe('Walker Industries');
      expect(res.body.data.role).toBe('CUSTOMER');
      expect(res.body.data.creditBalance).toBe('0.00');
    });

    it('updates customer profile details with valid payload', async () => {
      const res = await request(app)
        .patch('/api/users/profile')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          fullName: 'Alice Walker-Smith',
          companyName: 'Walker-Smith Enterprises',
          taxId: 'GSTIN27AABCU9603R1ZM',
          billingAddress: '42 Marina Boulevard, Suite 10, Mumbai, MH 400001',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe('Alice Walker-Smith');
      expect(res.body.data.companyName).toBe('Walker-Smith Enterprises');
      expect(res.body.data.taxId).toBe('GSTIN27AABCU9603R1ZM');
      expect(res.body.data.billingAddress).toBe(
        '42 Marina Boulevard, Suite 10, Mumbai, MH 400001',
      );

      // Verify in DB
      const dbUser = await prisma.user.findUnique({ where: { id: customer1Id } });
      expect(dbUser?.fullName).toBe('Alice Walker-Smith');
      expect(dbUser?.taxId).toBe('GSTIN27AABCU9603R1ZM');
    });

    it('rejects profile update with invalid full name (< 2 characters)', async () => {
      const res = await request(app)
        .patch('/api/users/profile')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          fullName: 'A',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects attempt to alter role or credit balance via mass-assignment', async () => {
      const res = await request(app)
        .patch('/api/users/profile')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          fullName: 'Alice Hacker',
          role: 'ADMIN',
          creditBalance: 999999.0,
        });

      // Strict zod schema rejects unrecognized fields
      expect(res.status).toBe(400);

      // Verify role & balance remain unchanged in database
      const dbUser = await prisma.user.findUnique({ where: { id: customer1Id } });
      expect(dbUser?.role).toBe(Role.CUSTOMER);
      expect(Number(dbUser?.creditBalance)).toBe(0);
    });
  });

  describe('2. Credit Balance Ledger & Transaction History', () => {
    it('returns empty ledger when customer has no credit transactions', async () => {
      const res = await request(app)
        .get('/api/users/credit-history')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerId).toBe(customer1Id);
      expect(res.body.data.creditBalance).toBe('0.00');
      expect(res.body.data.transactions).toHaveLength(0);
    });

    it('records surplus credit in ledger when customer overpays an invoice', async () => {
      // 1. Setup plan, product, subscription, and invoice for Customer 1
      const plan = await prisma.plan.create({
        data: {
          name: 'Credit Test Plan',
          billingFrequency: BillingFrequency.MONTHLY,
          isActive: true,
        },
      });

      await prisma.product.create({
        data: {
          name: 'Portal Test Service',
          salesPrice: 500.0,
          costPrice: 200.0,
          type: 'SERVICE',
        },
      });

      const sub = await prisma.subscription.create({
        data: {
          subscriptionNumber: 'SUB-2026-99001',
          customerId: customer1Id,
          planId: plan.id,
          status: 'ACTIVE',
          startDate: new Date(),
          nextBillingDate: new Date(Date.now() + 30 * 86400000),
        },
      });

      const inv = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-2026-99001',
          subscriptionId: sub.id,
          customerId: customer1Id,
          periodStartDate: new Date(),
          periodEndDate: new Date(Date.now() + 30 * 86400000),
          dueDate: new Date(Date.now() + 15 * 86400000),
          status: InvoiceStatus.CONFIRMED,
          subtotal: 500.0,
          taxAmount: 0.0,
          totalAmount: 500.0,
          paidAmount: 0.0,
        },
      });

      // 2. Staff records payment of 800.00 for invoice of 500.00 -> 300.00 surplus credited
      const payRes = await request(app)
        .post('/api/payments')
        .set('Cookie', staffCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          customerId: customer1Id,
          amount: 800.0,
          method: PaymentMethod.MANUAL_BANK_TRANSFER,
          notes: 'Customer paid ₹800 against ₹500 invoice',
          allocations: [{ invoiceId: inv.id, amount: 500.0 }],
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.data.surplusAmount).toBe('300.00');

      // 3. Customer checks credit history
      const historyRes = await request(app)
        .get('/api/users/credit-history')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.creditBalance).toBe('300.00');
      expect(historyRes.body.data.transactions).toHaveLength(1);

      const entry = historyRes.body.data.transactions[0];
      expect(entry.type).toBe('CREDIT');
      expect(entry.amount).toBe('300.00');
      expect(entry.reference).toContain('PAY-');
      expect(entry.description).toContain('Surplus payment credited');
    });

    it('records credit deduction in ledger when credit is applied to an invoice', async () => {
      // 1. Create a second invoice of 200.00 for Customer 1
      const sub = await prisma.subscription.findFirstOrThrow({
        where: { customerId: customer1Id },
      });

      const inv2 = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-2026-99002',
          subscriptionId: sub.id,
          customerId: customer1Id,
          periodStartDate: new Date(),
          periodEndDate: new Date(Date.now() + 30 * 86400000),
          dueDate: new Date(Date.now() + 15 * 86400000),
          status: InvoiceStatus.CONFIRMED,
          subtotal: 200.0,
          taxAmount: 0.0,
          totalAmount: 200.0,
          paidAmount: 0.0,
        },
      });

      // 2. Customer applies 200.00 of available credit to settle invoice 2
      const applyRes = await request(app)
        .post('/api/payments/apply-credit')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          invoiceId: inv2.id,
          amount: 200.0,
        });

      expect(applyRes.status).toBe(200);

      // 3. Customer checks credit ledger: should now have 2 transactions:
      // - Recent DEBIT of 200.00
      // - Older CREDIT of 300.00
      // Remaining credit balance: 100.00
      const historyRes = await request(app)
        .get('/api/users/credit-history')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.creditBalance).toBe('100.00');
      expect(historyRes.body.data.transactions).toHaveLength(2);

      const debitEntry = historyRes.body.data.transactions[0];
      expect(debitEntry.type).toBe('DEBIT');
      expect(debitEntry.amount).toBe('200.00');
      expect(debitEntry.description).toContain('INV-2026-99002');

      const creditEntry = historyRes.body.data.transactions[1];
      expect(creditEntry.type).toBe('CREDIT');
      expect(creditEntry.amount).toBe('300.00');
    });
  });

  describe('3. IDOR and Access Control Boundaries', () => {
    it('prevents Customer 1 from accessing Customer 2 credit history (IDOR protection)', async () => {
      const res = await request(app)
        .get(`/api/users/credit-history?customerId=${customer2Id}`)
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Customers cannot access other customer');
    });

    it('prevents Customer from creating staff accounts', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'illegal-staff@brightloop.io',
          password: 'IllegalStaff#123',
          fullName: 'Illegal Staff',
        });

      expect(res.status).toBe(403);
    });

    it('prevents Customer from listing all system users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', customer1Cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(403);
    });

    it('allows Staff to list users with search query parameter', async () => {
      const res = await request(app)
        .get('/api/users?search=Walker')
        .set('Cookie', staffCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].email).toBe('customer1@brightloop.io');
    });

    it('allows Staff to query any customer credit history using customerId query param', async () => {
      const res = await request(app)
        .get(`/api/users/credit-history?customerId=${customer1Id}`)
        .set('Cookie', staffCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerId).toBe(customer1Id);
      expect(res.body.data.creditBalance).toBe('100.00');
      expect(res.body.data.transactions).toHaveLength(2);
    });

    it('allows Admin to query any customer credit history using customerId query param', async () => {
      const res = await request(app)
        .get(`/api/users/credit-history?customerId=${customer1Id}`)
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerId).toBe(customer1Id);
      expect(res.body.data.creditBalance).toBe('100.00');
    });
  });
});
