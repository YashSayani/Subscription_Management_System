import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, Prisma } from '@brightloop/database';

describe('PostgreSQL Schema & Integrity Constraints', () => {
  beforeAll(async () => {
    // Ensure database connection
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.paymentAllocation.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.billingAttempt.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('generates valid formatted sequence numbers from PostgreSQL functions', async () => {
    const subRes = await prisma.$queryRaw<Array<{ num: string }>>`
      SELECT generate_subscription_number() AS num;
    `;
    const invRes = await prisma.$queryRaw<Array<{ num: string }>>`
      SELECT generate_invoice_number() AS num;
    `;
    const payRes = await prisma.$queryRaw<Array<{ num: string }>>`
      SELECT generate_payment_number() AS num;
    `;

    const currentYear = new Date().getFullYear().toString();

    expect(subRes[0].num).toMatch(new RegExp(`^SUB-${currentYear}-\\d{5}$`));
    expect(invRes[0].num).toMatch(new RegExp(`^INV-${currentYear}-\\d{5}$`));
    expect(payRes[0].num).toMatch(new RegExp(`^PAY-${currentYear}-\\d{5}$`));
  });

  it('rejects negative sales_price via SQL CHECK constraint', async () => {
    await expect(
      prisma.product.create({
        data: {
          name: 'Invalid Price Product',
          salesPrice: new Prisma.Decimal(-50.0),
          costPrice: new Prisma.Decimal(10.0),
        },
      }),
    ).rejects.toThrow();
  });

  it('enforces NUMERIC(14,2) decimal precision on monetary figures', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Enterprise Cloud ERP',
        type: 'SERVICE',
        salesPrice: new Prisma.Decimal(12500.5),
        costPrice: new Prisma.Decimal(8000.25),
      },
    });

    expect(product.salesPrice.toString()).toBe('12500.5');
    expect(product.costPrice.toString()).toBe('8000.25');

    // Add variant with price adjustment
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        attributeName: 'Brand',
        attributeValue: 'Odoo',
        priceAdjustment: new Prisma.Decimal(560.0),
      },
    });

    expect(variant.priceAdjustment.toString()).toBe('560');
  });

  it('enforces composite UNIQUE constraint (subscription_id, period_start_date) on invoices', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'customer-test@brightloop.io',
        passwordHash: 'dummy_hash_for_test_123',
        fullName: 'Test Customer',
        role: 'CUSTOMER',
      },
    });

    const plan = await prisma.plan.create({
      data: {
        name: 'Monthly Pro',
        billingFrequency: 'MONTHLY',
        minQuantity: 1,
      },
    });

    const subNumRes = await prisma.$queryRaw<Array<{ num: string }>>`
      SELECT generate_subscription_number() AS num;
    `;

    const subscription = await prisma.subscription.create({
      data: {
        subscriptionNumber: subNumRes[0].num,
        customerId: user.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        nextBillingDate: new Date('2026-12-01T00:00:00.000Z'),
      },
    });

    const invNum1 = await prisma.$queryRaw<Array<{ num: string }>>`
      SELECT generate_invoice_number() AS num;
    `;

    const periodStart = new Date('2026-11-01T00:00:00.000Z');
    const periodEnd = new Date('2026-11-30T23:59:59.999Z');

    // Create 1st invoice for this period
    await prisma.invoice.create({
      data: {
        invoiceNumber: invNum1[0].num,
        subscriptionId: subscription.id,
        customerId: user.id,
        status: 'CONFIRMED',
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        dueDate: new Date('2026-11-15T00:00:00.000Z'),
        subtotal: new Prisma.Decimal(100.0),
        taxAmount: new Prisma.Decimal(18.0),
        totalAmount: new Prisma.Decimal(118.0),
        paidAmount: new Prisma.Decimal(0.0),
      },
    });

    const invNum2 = await prisma.$queryRaw<Array<{ num: string }>>`
      SELECT generate_invoice_number() AS num;
    `;

    // Duplicate invoice for the EXACT SAME period must fail due to unique constraint
    await expect(
      prisma.invoice.create({
        data: {
          invoiceNumber: invNum2[0].num,
          subscriptionId: subscription.id,
          customerId: user.id,
          status: 'DRAFT',
          periodStartDate: periodStart, // duplicate period
          periodEndDate: periodEnd,
          dueDate: new Date('2026-11-15T00:00:00.000Z'),
          subtotal: new Prisma.Decimal(100.0),
          totalAmount: new Prisma.Decimal(118.0),
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects paid_amount > total_amount on Invoice via SQL CHECK constraint', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: 'customer-test@brightloop.io' } });
    const subscription = await prisma.subscription.findFirstOrThrow();

    const invNum = await prisma.$queryRaw<Array<{ num: string }>>`
      SELECT generate_invoice_number() AS num;
    `;

    // Attempting paid_amount (150) > total_amount (100) must trigger invoices_paid_lte_total_check
    await expect(
      prisma.invoice.create({
        data: {
          invoiceNumber: invNum[0].num,
          subscriptionId: subscription.id,
          customerId: user.id,
          status: 'CONFIRMED',
          periodStartDate: new Date('2026-12-01T00:00:00.000Z'),
          periodEndDate: new Date('2026-12-31T23:59:59.999Z'),
          dueDate: new Date('2026-12-15T00:00:00.000Z'),
          subtotal: new Prisma.Decimal(100.0),
          totalAmount: new Prisma.Decimal(100.0),
          paidAmount: new Prisma.Decimal(150.0), // Invalid overpayment
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects negative customer credit_balance via SQL CHECK constraint', async () => {
    await expect(
      prisma.user.create({
        data: {
          email: 'invalid-credit@brightloop.io',
          passwordHash: 'hash',
          fullName: 'Negative Credit Test',
          creditBalance: new Prisma.Decimal(-25.0),
        },
      }),
    ).rejects.toThrow();
  });
});
