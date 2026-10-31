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

describe('Manual Payments & Allocation Engine Module', () => {
  let adminCookie: string;
  let staffCookie: string;
  let customerACookie: string;
  let customerBCookie: string;
  let customerAId: string;

  let invoice1Id: string;
  let invoice2Id: string;

  beforeAll(async () => {
    // Clean up
    await prisma.billingAttempt.deleteMany();
    await prisma.paymentAllocation.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
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
        email: 'pay-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Payment Admin',
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
        email: 'pay-staff@brightloop.io',
        passwordHash: staffPasswordHash,
        fullName: 'Payment Staff',
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

    // 3. Create Customer A
    const custAPasswordHash = await bcrypt.hash('CustomerPass#123', 12);
    const customerA = await prisma.user.create({
      data: {
        email: 'pay-cust-a@brightloop.io',
        passwordHash: custAPasswordHash,
        fullName: 'Acme Payments Client',
        role: Role.CUSTOMER,
        creditBalance: 0.0,
        isActive: true,
      },
    });
    customerAId = customerA.id;

    const custALogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: customerA.email, password: 'CustomerPass#123' });
    customerACookie =
      custALogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 4. Create Customer B
    const custBPasswordHash = await bcrypt.hash('CustomerPass#123', 12);
    const customerB = await prisma.user.create({
      data: {
        email: 'pay-cust-b@brightloop.io',
        passwordHash: custBPasswordHash,
        fullName: 'Beta Industries',
        role: Role.CUSTOMER,
        creditBalance: 0.0,
        isActive: true,
      },
    });

    const custBLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: customerB.email, password: 'CustomerPass#123' });
    customerBCookie =
      custBLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';

    // 5. Create Plan & Product
    const plan = await prisma.plan.create({
      data: {
        name: 'Enterprise Monthly Plan',
        billingFrequency: BillingFrequency.MONTHLY,
        minQuantity: 1,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'SaaS License',
        salesPrice: 1000.0,
        costPrice: 500.0,
      },
    });

    // 6. Create Subscription for Customer A
    const sub = await prisma.subscription.create({
      data: {
        subscriptionNumber: 'SUB-2026-90001',
        customerId: customerAId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        lines: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 1000.0,
            subtotal: 1000.0,
            taxRate: 18.0,
            taxAmount: 180.0,
            totalAmount: 1180.0,
          },
        },
      },
    });

    // 7. Create Invoice 1 for Customer A (Total: ₹1180.00, Paid: ₹0)
    const inv1 = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-90001',
        subscriptionId: sub.id,
        customerId: customerAId,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: new Date('2026-01-01'),
        periodEndDate: new Date('2026-01-31'),
        dueDate: new Date('2026-01-15'),
        subtotal: 1000.0,
        taxAmount: 180.0,
        totalAmount: 1180.0,
        paidAmount: 0.0,
        lines: {
          create: {
            productId: product.id,
            description: 'SaaS License (Jan 2026)',
            quantity: 1,
            unitPrice: 1000.0,
            taxRate: 18.0,
            subtotal: 1000.0,
            taxAmount: 180.0,
            totalAmount: 1180.0,
          },
        },
      },
    });
    invoice1Id = inv1.id;

    // 8. Create Invoice 2 for Customer A (Total: ₹500.00, Paid: ₹0)
    const inv2 = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-90002',
        subscriptionId: sub.id,
        customerId: customerAId,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: new Date('2026-02-01'),
        periodEndDate: new Date('2026-02-28'),
        dueDate: new Date('2026-02-15'),
        subtotal: 423.73,
        taxAmount: 76.27,
        totalAmount: 500.0,
        paidAmount: 0.0,
        lines: {
          create: {
            productId: product.id,
            description: 'SaaS Addon License',
            quantity: 1,
            unitPrice: 423.73,
            taxRate: 18.0,
            subtotal: 423.73,
            taxAmount: 76.27,
            totalAmount: 500.0,
          },
        },
      },
    });
    invoice2Id = inv2.id;
  });

  afterAll(async () => {
    await prisma.billingAttempt.deleteMany();
    await prisma.paymentAllocation.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects recording payments by Customer role with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Cookie', customerACookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        customerId: customerAId,
        amount: 500.0,
        method: PaymentMethod.MANUAL_BANK_TRANSFER,
      });

    expect(res.status).toBe(403);
  });

  it('allows Staff to record a partial offline payment and updates invoice to PARTIALLY_PAID', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Cookie', staffCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        customerId: customerAId,
        amount: 580.0,
        method: PaymentMethod.MANUAL_BANK_TRANSFER,
        notes: 'Wire transfer partial payment for Invoice 1',
        allocations: [
          {
            invoiceId: invoice1Id,
            amount: 580.0,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentNumber).toMatch(/^PAY-\d{4}-\d{5}$/);
    expect(Number(res.body.data.amount)).toBe(580);
    expect(res.body.data.allocations).toHaveLength(1);
    expect(res.body.data.totalAllocated).toBe('580.00');
    expect(res.body.data.surplusAmount).toBe('0.00');

    // Verify invoice status updated to PARTIALLY_PAID
    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice1Id },
    });
    expect(updatedInvoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(Number(updatedInvoice.paidAmount)).toBe(580.0);
  });

  it('rejects allocation exceeding the remaining balance due', async () => {
    // Invoice 1 remaining balance is 1180 - 580 = 600
    const res = await request(app)
      .post('/api/payments')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        customerId: customerAId,
        amount: 700.0,
        method: PaymentMethod.CHEQUE,
        allocations: [
          {
            invoiceId: invoice1Id,
            amount: 650.0, // Exceeds remaining balance of 600
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('exceeds balance due');
  });

  it('settles remaining invoice balance and credits surplus to Customer credit balance (Decision D-07)', async () => {
    // Invoice 1 remaining balance is 600.00
    // Record payment of 800.00, allocate 600.00 to Invoice 1, surplus 200.00 goes to credit_balance
    const res = await request(app)
      .post('/api/payments')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        customerId: customerAId,
        amount: 800.0,
        method: PaymentMethod.CHEQUE,
        notes: 'Cheque CHQ-889912 with surplus credit',
        allocations: [
          {
            invoiceId: invoice1Id,
            amount: 600.0,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.amount)).toBe(800);
    expect(res.body.data.totalAllocated).toBe('600.00');
    expect(res.body.data.surplusAmount).toBe('200.00');

    // Verify Invoice 1 is now fully PAID
    const settledInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice1Id },
    });
    expect(settledInvoice.status).toBe(InvoiceStatus.PAID);
    expect(Number(settledInvoice.paidAmount)).toBe(1180.0);

    // Verify customer's credit balance was incremented by 200.00 (Decision D-07)
    const updatedCustomer = await prisma.user.findUniqueOrThrow({
      where: { id: customerAId },
    });
    expect(Number(updatedCustomer.creditBalance)).toBe(200.0);

    // Verify audit log entry was created
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityId: customerAId,
        action: 'PAYMENT_SURPLUS_CREDITED',
      },
    });
    expect(auditLog).toBeDefined();
  });

  it('rejects further payment allocations to an already PAID invoice', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        customerId: customerAId,
        amount: 100.0,
        method: PaymentMethod.CASH,
        allocations: [
          {
            invoiceId: invoice1Id, // Fully paid
            amount: 100.0,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already fully paid');
  });

  it('allows Customer to apply credit balance to pay down an open invoice', async () => {
    // Customer has 200.00 credit balance. Invoice 2 has 500.00 balance due.
    const res = await request(app)
      .post('/api/payments/apply-credit')
      .set('Cookie', customerACookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        invoiceId: invoice2Id,
        amount: 150.0,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentNumber).toMatch(/^PAY-\d{4}-\d{5}$/);
    expect(Number(res.body.data.amount)).toBe(150);

    // Customer credit balance should be 200 - 150 = 50.00
    const customer = await prisma.user.findUniqueOrThrow({
      where: { id: customerAId },
    });
    expect(Number(customer.creditBalance)).toBe(50.0);

    // Invoice 2 should be PARTIALLY_PAID with 150.00 paid
    const invoice2 = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice2Id },
    });
    expect(invoice2.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(Number(invoice2.paidAmount)).toBe(150.0);
  });

  it('rejects applying credit when requested amount exceeds available credit balance', async () => {
    // Customer has 50.00 credit balance remaining. Requesting 100.00 must fail.
    const res = await request(app)
      .post('/api/payments/apply-credit')
      .set('Cookie', customerACookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        invoiceId: invoice2Id,
        amount: 100.0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Insufficient customer credit balance');
  });

  it('enforces IDOR isolation: Customer B cannot apply credit to Customer A invoice', async () => {
    // Customer B tries to apply credit to Customer A's invoice
    const res = await request(app)
      .post('/api/payments/apply-credit')
      .set('Cookie', customerBCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        invoiceId: invoice2Id, // Belongs to Customer A
        amount: 50.0,
      });

    expect(res.status).toBe(404);
  });

  it('enforces IDOR isolation: Customer B cannot view Customer A payment record', async () => {
    // Find payment of Customer A
    const custAPayment = await prisma.payment.findFirstOrThrow({
      where: { customerId: customerAId },
    });

    const res = await request(app)
      .get(`/api/payments/${custAPayment.id}`)
      .set('Cookie', customerBCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(404);
  });

  it('allows Customer A to list own payments and see allocations', async () => {
    const res = await request(app)
      .get('/api/payments')
      .set('Cookie', customerACookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    // Verify all returned payments belong to Customer A
    for (const payment of res.body.data) {
      expect(payment.customerId).toBe(customerAId);
    }
  });

  it('allows Admin to list all payments across customers with search and pagination', async () => {
    const res = await request(app)
      .get('/api/payments?limit=10')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });
});
