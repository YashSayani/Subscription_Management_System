import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role, BillingFrequency } from '@brightloop/database';

describe('Catalog Module (Products, Variants & Plans)', () => {
  let adminCookie: string;
  let customerCookie: string;

  beforeAll(async () => {
    // Clean up
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create Admin User
    const adminPasswordHash = await bcrypt.hash('AdminPass#123', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'catalog-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Catalog Admin',
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

    // 2. Create Customer User
    const customerPasswordHash = await bcrypt.hash('CustomerPass#123', 12);
    const customer = await prisma.user.create({
      data: {
        email: 'catalog-customer@brightloop.io',
        passwordHash: customerPasswordHash,
        fullName: 'Catalog Customer',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });

    const customerLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: customer.email, password: 'CustomerPass#123' });

    customerCookie =
      customerLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';
  });

  afterAll(async () => {
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('Product & Variant Management (RBAC & Persistence)', () => {
    let createdProductId: string;
    let createdVariantId: string;

    it('rejects product creation by non-admin customer with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/catalog/products')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerCookie)
        .send({
          name: 'Unauthorized SaaS Package',
          salesPrice: 999.0,
          costPrice: 50.0,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Admin to create a Product with configurable variant price adjustments', async () => {
      const res = await request(app)
        .post('/api/catalog/products')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          name: 'Brightloop CRM Enterprise',
          description: 'Cloud subscription CRM platform',
          type: 'SERVICE',
          salesPrice: 1500.0,
          costPrice: 300.0,
          variants: [
            {
              attributeName: 'Brand',
              attributeValue: 'Odoo',
              priceAdjustment: 560.0, // Brand "Odoo" adds 560
              isAvailable: true,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product).toBeDefined();
      expect(res.body.data.product.name).toBe('Brightloop CRM Enterprise');
      expect(Number(res.body.data.product.salesPrice)).toBe(1500.0);
      expect(res.body.data.product.variants).toHaveLength(1);
      expect(res.body.data.product.variants[0].attributeName).toBe('Brand');
      expect(res.body.data.product.variants[0].attributeValue).toBe('Odoo');
      expect(Number(res.body.data.product.variants[0].priceAdjustment)).toBe(560.0);

      createdProductId = res.body.data.product.id;
      createdVariantId = res.body.data.product.variants[0].id;
    });

    it('allows Admin to add additional variants to an existing product', async () => {
      const res = await request(app)
        .post(`/api/catalog/products/${createdProductId}/variants`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          attributeName: 'Hosting',
          attributeValue: 'Dedicated Cloud',
          priceAdjustment: 400.0,
          isAvailable: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.variant.attributeName).toBe('Hosting');
      expect(res.body.data.variant.attributeValue).toBe('Dedicated Cloud');
      expect(Number(res.body.data.variant.priceAdjustment)).toBe(400.0);
    });

    it('rejects duplicate variant on same product with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/catalog/products/${createdProductId}/variants`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          attributeName: 'Brand',
          attributeValue: 'Odoo',
          priceAdjustment: 560.0,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('allows Customer to view the product and its variants', async () => {
      const res = await request(app)
        .get(`/api/catalog/products/${createdProductId}`)
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.variants).toHaveLength(2);
    });

    it('allows Admin to update variant price adjustment', async () => {
      const res = await request(app)
        .patch(`/api/catalog/variants/${createdVariantId}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          priceAdjustment: 580.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.variant.priceAdjustment)).toBe(580.0);
    });

    it('allows Admin to soft-delete a product', async () => {
      const res = await request(app)
        .delete(`/api/catalog/products/${createdProductId}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify soft deleted in DB
      const dbProduct = await prisma.product.findUnique({
        where: { id: createdProductId },
      });
      expect(dbProduct?.deletedAt).not.toBeNull();
      expect(dbProduct?.isAvailable).toBe(false);

      // Querying without includeArchived should return 404
      const getRes = await request(app)
        .get(`/api/catalog/products/${createdProductId}`)
        .set('Cookie', customerCookie);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Plans Management', () => {
    let createdPlanId: string;

    it('rejects plan creation by non-admin customer with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/catalog/plans')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerCookie)
        .send({
          name: 'Unauthorized Annual Plan',
          billingFrequency: BillingFrequency.YEARLY,
        });

      expect(res.status).toBe(403);
    });

    it('allows Admin to create subscription plans with frequencies and rules', async () => {
      const res = await request(app)
        .post('/api/catalog/plans')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          name: 'Monthly Standard Subscription',
          description: 'Standard monthly billing with pause option',
          billingFrequency: BillingFrequency.MONTHLY,
          minQuantity: 1,
          autoClose: false,
          pauseAllowed: true,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan.name).toBe('Monthly Standard Subscription');
      expect(res.body.data.plan.billingFrequency).toBe('MONTHLY');
      expect(res.body.data.plan.pauseAllowed).toBe(true);

      createdPlanId = res.body.data.plan.id;
    });

    it('allows Customers to list active plans', async () => {
      const res = await request(app)
        .get('/api/catalog/plans')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plans.length).toBeGreaterThanOrEqual(1);
    });

    it('allows Admin to soft-delete a plan', async () => {
      const res = await request(app)
        .delete(`/api/catalog/plans/${createdPlanId}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbPlan = await prisma.plan.findUnique({
        where: { id: createdPlanId },
      });
      expect(dbPlan?.deletedAt).not.toBeNull();
      expect(dbPlan?.isActive).toBe(false);
    });
  });

  describe('Dynamic Price Calculation Engine', () => {
    let calcProductId: string;
    let odooVariantId: string;
    let cloudVariantId: string;

    beforeAll(async () => {
      // Create product with Base 1500, Odoo adds 560, Cloud adds 400
      const prodRes = await request(app)
        .post('/api/catalog/products')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          name: 'Brightloop ERP Platform',
          salesPrice: 1500.0,
          costPrice: 400.0,
          variants: [
            {
              attributeName: 'Brand',
              attributeValue: 'Odoo',
              priceAdjustment: 560.0,
            },
            {
              attributeName: 'Hosting',
              attributeValue: 'Dedicated Cloud',
              priceAdjustment: 400.0,
            },
          ],
        });

      calcProductId = prodRes.body.data.product.id;
      odooVariantId = prodRes.body.data.product.variants.find(
        (v: { id: string; attributeValue: string }) => v.attributeValue === 'Odoo',
      ).id;
      cloudVariantId = prodRes.body.data.product.variants.find(
        (v: { id: string; attributeValue: string }) => v.attributeValue === 'Dedicated Cloud',
      ).id;
    });

    it('calculates price accurately: base 1500 + Odoo 560 = 2060 unit price, qty 2 = 4120 subtotal', async () => {
      const res = await request(app)
        .post('/api/catalog/calculate-price')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerCookie)
        .send({
          productId: calcProductId,
          variantIds: [odooVariantId],
          quantity: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { calculation } = res.body.data;
      expect(calculation.basePrice).toBe('1500.00');
      expect(calculation.sumAdjustments).toBe('560.00');
      expect(calculation.unitPrice).toBe('2060.00');
      expect(calculation.quantity).toBe(2);
      expect(calculation.subtotal).toBe('4120.00');
    });

    it('calculates multi-variant combined pricing: 1500 + 560 + 400 = 2460, qty 3 = 7380', async () => {
      const res = await request(app)
        .post('/api/catalog/calculate-price')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerCookie)
        .send({
          productId: calcProductId,
          variantIds: [odooVariantId, cloudVariantId],
          quantity: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { calculation } = res.body.data;
      expect(calculation.basePrice).toBe('1500.00');
      expect(calculation.sumAdjustments).toBe('960.00');
      expect(calculation.unitPrice).toBe('2460.00');
      expect(calculation.quantity).toBe(3);
      expect(calculation.subtotal).toBe('7380.00');
    });
  });
});
