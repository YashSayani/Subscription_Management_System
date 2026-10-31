import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role } from '@brightloop/database';

describe('Admin Customer Creation & Onboarding', () => {
  let adminCookie: string;
  let customerCookie: string;

  beforeAll(async () => {
    // Clean up test database in reverse FK order
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

    // 1. Seed Admin
    const adminPasswordHash = await bcrypt.hash('AdminPassword#123', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'superadmin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'System Super Admin',
        role: Role.ADMIN,
        isActive: true,
      },
    });

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: admin.email,
        password: 'AdminPassword#123',
      });

    adminCookie = adminLoginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 2. Seed an existing customer to test RBAC and conflicts
    const custPasswordHash = await bcrypt.hash('CustomerPass#123', 12);
    const existingCust = await prisma.user.create({
      data: {
        email: 'existing.customer@example.com',
        passwordHash: custPasswordHash,
        fullName: 'Existing Customer',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });

    const custLoginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: existingCust.email,
        password: 'CustomerPass#123',
      });

    customerCookie = custLoginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
  });

  it('allows Admin to create a new customer with a custom password and initial credit', async () => {
    const res = await request(app)
      .post('/api/users/customers')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        fullName: 'Vikram Mehta',
        email: 'vikram.mehta@acme.org',
        password: 'CustomSecret#2026',
        companyName: 'Acme Technologies Pvt Ltd',
        taxId: '27AABCU9603R1ZM',
        billingAddress: '402 Cyber City, Gurugram, HR',
        initialCredit: 1500.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer.fullName).toBe('Vikram Mehta');
    expect(res.body.data.customer.email).toBe('vikram.mehta@acme.org');
    expect(res.body.data.customer.role).toBe('CUSTOMER');
    expect(res.body.data.customer.companyName).toBe('Acme Technologies Pvt Ltd');
    expect(res.body.data.customer.creditBalance).toBe('1500.50');
    expect(res.body.data.customer.passwordHash).toBeUndefined();

    // Verify audit logs were created
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: res.body.data.customer.id },
    });
    const actions = auditLogs.map((l) => l.action);
    expect(actions).toContain('CUSTOMER_CREATED');
    expect(actions).toContain('PAYMENT_SURPLUS_CREDITED');

    // Verify the new customer can immediately log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: 'vikram.mehta@acme.org',
        password: 'CustomSecret#2026',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.fullName).toBe('Vikram Mehta');
  });

  it('allows Admin to create a customer with an auto-generated password', async () => {
    const res = await request(app)
      .post('/api/users/customers')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        fullName: 'Kavita Iyer',
        email: 'kavita.iyer@fintech.io',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer.fullName).toBe('Kavita Iyer');
    expect(res.body.data.temporaryPassword).toBeDefined();
    expect(res.body.data.temporaryPassword).toMatch(/^Bright#/);

    // Verify the customer can log in using the auto-generated password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: 'kavita.iyer@fintech.io',
        password: res.body.data.temporaryPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.email).toBe('kavita.iyer@fintech.io');
  });

  it('rejects creating a customer with an already registered email with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/users/customers')
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        fullName: 'Duplicate Tester',
        email: 'existing.customer@example.com',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  it('forbids regular customers from creating other customers (RBAC 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/users/customers')
      .set('Cookie', customerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        fullName: 'Unauthorized Attempt',
        email: 'hacker@example.com',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
