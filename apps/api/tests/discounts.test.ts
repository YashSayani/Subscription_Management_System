import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role, DiscountType, Prisma } from '@brightloop/database';
import { DiscountService } from '../src/modules/discounts/service.js';

describe('Discounts & Atomic Counter Engine Module', () => {
  let adminCookie: string;
  let staffCookie: string;
  let customerCookie: string;

  let percentDiscountId: string;
  let fixedDiscountId: string;
  let limitedDiscountId: string;

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
        email: 'disc-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Discount Admin',
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
        email: 'disc-staff@brightloop.io',
        passwordHash: staffPasswordHash,
        fullName: 'Discount Staff',
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
        email: 'disc-cust@brightloop.io',
        passwordHash: custPasswordHash,
        fullName: 'Shopper Customer',
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

  it('rejects discount creation by Staff or Customer with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Cookie', staffCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'STAFF10',
        name: 'Staff Promo',
        type: DiscountType.PERCENTAGE,
        value: 10,
      });

    expect(res.status).toBe(403);
  });

  it('allows Admin to create a percentage discount coupon', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'SAVE20',
        name: 'Early Bird 20%',
        description: '20% off all subscriptions',
        type: DiscountType.PERCENTAGE,
        value: 20.0,
        usageLimit: 100,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('SAVE20');
    expect(res.body.data.type).toBe(DiscountType.PERCENTAGE);
    expect(res.body.data.usedCount).toBe(0);
    percentDiscountId = res.body.data.id;
  });

  it('allows Admin to fetch discount by id', async () => {
    const res = await request(app)
      .get(`/api/discounts/${percentDiscountId}`)
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(percentDiscountId);
    expect(res.body.data.code).toBe('SAVE20');
  });

  it('allows Admin to create a fixed amount discount coupon with min subtotal', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'FLAT500',
        name: 'Flat ₹500 Off',
        type: DiscountType.FIXED_AMOUNT,
        value: 500.0,
        minPurchaseAmount: 2000.0,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('FLAT500');
    expect(res.body.data.type).toBe(DiscountType.FIXED_AMOUNT);
    fixedDiscountId = res.body.data.id;
  });

  it('rejects percentage discount value exceeding 100%', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'INVALID150',
        name: 'Too High Discount',
        type: DiscountType.PERCENTAGE,
        value: 150.0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('cannot exceed 100%');
  });

  it('validates percentage discount calculation for Customer', async () => {
    // Validating SAVE20 against subtotal 1000.00
    // 20% of 1000 = 200 discount, newSubtotal = 800.00
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'SAVE20',
        subtotal: 1000.0,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.discountAmount).toBe('200.00');
    expect(res.body.data.newSubtotal).toBe('800.00');
  });

  it('rejects fixed discount when order subtotal is below minPurchaseAmount', async () => {
    // FLAT500 requires minPurchaseAmount 2000.00. Testing with 1500.00.
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'FLAT500',
        subtotal: 1500.0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Minimum order subtotal');
  });

  it('accepts fixed discount when subtotal meets minPurchaseAmount', async () => {
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'FLAT500',
        subtotal: 2500.0,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.discountAmount).toBe('500.00');
    expect(res.body.data.newSubtotal).toBe('2000.00');
  });

  it('rejects expired discount code', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);

    await prisma.discount.create({
      data: {
        code: 'EXPIRED10',
        name: 'Expired Promo',
        type: DiscountType.PERCENTAGE,
        value: 10.0,
        validUntil: pastDate,
        isActive: true,
      },
    });

    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'EXPIRED10',
        subtotal: 500.0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('has expired');
  });

  it('allows Admin to update discount active state and limits', async () => {
    const res = await request(app)
      .patch(`/api/discounts/${fixedDiscountId}`)
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        name: 'Updated Flat Promo',
        isActive: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.name).toBe('Updated Flat Promo');

    // Validation must now reject because isActive is false
    const validateRes = await request(app)
      .post('/api/discounts/validate')
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        code: 'FLAT500',
        subtotal: 3000.0,
      });

    expect(validateRes.status).toBe(400);
    expect(validateRes.body.error.message).toContain('invalid or inactive');
  });

  it('neutralizes concurrency race condition: 5 simultaneous redemptions against limit of 1 yields exactly 1 success (Threat Model 4.5)', async () => {
    // Create coupon with strictly usageLimit = 1
    const limitedDiscount = await prisma.discount.create({
      data: {
        code: 'FLASH1',
        name: 'One-Time Flash Deal',
        type: DiscountType.FIXED_AMOUNT,
        value: 100.0,
        usageLimit: 1,
        usedCount: 0,
        isActive: true,
      },
    });
    limitedDiscountId = limitedDiscount.id;

    const subtotal = new Prisma.Decimal(500.0);

    // Concurrently trigger 5 atomic redemption calls
    const attempts = [1, 2, 3, 4, 5].map(async () => {
      try {
        return await prisma.$transaction(async (tx) => {
          return DiscountService.redeemDiscountAtomic(tx, limitedDiscountId, subtotal);
        });
      } catch (err) {
        return { error: (err as Error).message };
      }
    });

    const results = await Promise.all(attempts);

    const successful = results.filter((r) => 'discountAmount' in r);
    const failed = results.filter((r) => 'error' in r);

    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(4);

    // Verify DB record has usedCount = 1 and NOT 5
    const dbRecord = await prisma.discount.findUniqueOrThrow({
      where: { id: limitedDiscountId },
    });
    expect(dbRecord.usedCount).toBe(1);
    expect(dbRecord.usageLimit).toBe(1);
  });
});
