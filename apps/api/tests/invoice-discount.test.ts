import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role, DiscountType, InvoiceStatus } from '@brightloop/database';

describe('Discount Coupon Application by Customer on Invoices', () => {
  let customerCookie: string;
  let customerId: string;
  let testInvoiceId: string;
  let testDiscountId: string;

  beforeAll(async () => {
    // 1. Clean DB tables in correct order
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

    // 2. Create customer
    const passwordHash = await bcrypt.hash('CustomerPass#123', 12);
    const customer = await prisma.user.create({
      data: {
        email: 'coupon.customer@example.com',
        passwordHash,
        fullName: 'Coupon Customer',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });
    customerId = customer.id;

    // Login customer
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: 'coupon.customer@example.com',
        password: 'CustomerPass#123',
      });
    customerCookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 3. Create active product and plan
    const product = await prisma.product.create({
      data: {
        name: 'Cloud Storage Pro',
        salesPrice: 2000.0,
        costPrice: 500.0,
        type: 'SERVICE',
        isAvailable: true,
      },
    });

    const plan = await prisma.plan.create({
      data: {
        name: 'Monthly Pro Plan',
        billingFrequency: 'MONTHLY',
        minQuantity: 1,
        isActive: true,
      },
    });

    // 4. Create subscription
    const sub = await prisma.subscription.create({
      data: {
        subscriptionNumber: 'SUB-2026-00099',
        customerId,
        planId: plan.id,
        status: 'ACTIVE',
      },
    });

    // 5. Create active coupon code: 20% discount on orders >= 1000
    const discount = await prisma.discount.create({
      data: {
        code: 'TESTSAVE20',
        name: '20 Percent Off',
        type: DiscountType.PERCENTAGE,
        value: 20.0,
        minPurchaseAmount: 1000.0,
        usageLimit: 10,
        usedCount: 0,
        isActive: true,
      },
    });
    testDiscountId = discount.id;

    // 6. Create open invoice: subtotal = 2000, tax = 360 (18%), total = 2360
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-00099',
        subscriptionId: sub.id,
        customerId,
        status: InvoiceStatus.CONFIRMED,
        periodStartDate: new Date(),
        periodEndDate: new Date(),
        dueDate: new Date(Date.now() + 15 * 86400000),
        subtotal: 2000.0,
        discountAmount: 0.0,
        taxAmount: 360.0,
        totalAmount: 2360.0,
        paidAmount: 0.0,
        lines: {
          create: [
            {
              productId: product.id,
              description: 'Cloud Storage Pro Monthly',
              quantity: 1,
              unitPrice: 2000.0,
              taxRate: 18.0,
              subtotal: 2000.0,
              taxAmount: 360.0,
              totalAmount: 2360.0,
            },
          ],
        },
      },
    });
    testInvoiceId = invoice.id;
  });

  it('allows customer to apply a valid discount coupon to their open invoice', async () => {
    const res = await request(app)
      .post(`/api/invoices/${testInvoiceId}/apply-discount`)
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ code: 'TESTSAVE20' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const inv = res.body.data.invoice;
    // 20% of 2000 = 400 discount
    expect(Number(inv.discountAmount)).toBe(400.0);
    // New total: (2000 - 400) + 360 = 1960.00
    expect(Number(inv.totalAmount)).toBe(1960.0);
    expect(Number(inv.balanceDue)).toBe(1960.0);
    expect(inv.discountId).toBe(testDiscountId);

    // Verify atomic usage count incremented
    const updatedDiscount = await prisma.discount.findUnique({
      where: { id: testDiscountId },
    });
    expect(updatedDiscount?.usedCount).toBe(1);

    // Verify audit log
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityId: testInvoiceId,
        action: 'DISCOUNT_APPLIED_TO_INVOICE',
      },
    });
    expect(auditLog).toBeDefined();
    expect((auditLog?.newValues as any)?.couponCode).toBe('TESTSAVE20');
  });

  it('rejects applying a second discount to an invoice that already has one', async () => {
    const res = await request(app)
      .post(`/api/invoices/${testInvoiceId}/apply-discount`)
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ code: 'TESTSAVE20' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already been applied/i);
  });
});
