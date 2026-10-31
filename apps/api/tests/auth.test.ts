import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma, Role } from '@brightloop/database';

describe('Auth & RBAC Module', () => {
  let adminCookie: string;
  let staffCookie: string;
  let customerCookie: string;
  let customerRefreshToken: string;

  beforeAll(async () => {
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

    // Seed one ADMIN user
    const adminPasswordHash = await bcrypt.hash('AdminPassword#123', 12);
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Super Admin',
        role: Role.ADMIN,
        isActive: true,
      },
    });

    // Obtain Admin Auth Cookie
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: adminUser.email,
        password: 'AdminPassword#123',
      });

    adminCookie = adminLoginRes.headers['set-cookie']
      .find((c: string) => c.startsWith('access_token='))
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
    await prisma.$disconnect();
  });

  describe('Password Policy & Registration', () => {
    it('rejects passwords under 9 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'shortpass@brightloop.io',
          password: 'Pass1@',
          fullName: 'Short Pass',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details.password).toContain('Password must be at least 9 characters long');
    });

    it('rejects passwords without special characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'nospecial@brightloop.io',
          password: 'Password123',
          fullName: 'No Special',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.password).toContain('Password must contain at least one special character');
    });

    it('rejects passwords without uppercase letters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'nouppercase@brightloop.io',
          password: 'password#123',
          fullName: 'No Upper',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.password).toContain('Password must contain at least one uppercase letter');
    });

    it('registers customer and enforces Role=CUSTOMER despite mass-assignment attempts', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'customer1@brightloop.io',
          password: 'ValidPassword#123',
          fullName: 'Alice Customer',
          companyName: 'Acme Corp',
          role: 'ADMIN', // Mass-assignment attack attempt
        });

      // Zod .strict() rejects undeclared role field on registerSchema
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('registers valid customer and emits dual HttpOnly SameSite=Strict cookies', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'customer1@brightloop.io',
          password: 'ValidPassword#123',
          fullName: 'Alice Customer',
          companyName: 'Acme Corp',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('customer1@brightloop.io');
      expect(res.body.data.user.role).toBe('CUSTOMER');

      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();

      const accessCookie = cookies.find((c) => c.startsWith('access_token='));
      const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

      expect(accessCookie).toContain('HttpOnly');
      expect(accessCookie).toContain('SameSite=Strict');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Strict');

      customerCookie = accessCookie?.split(';')[0] || '';
      customerRefreshToken = refreshCookie?.split(';')[0]?.replace('refresh_token=', '') || '';
    });

    it('rejects duplicate email registration with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'customer1@brightloop.io',
          password: 'ValidPassword#123',
          fullName: 'Duplicate Alice',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('Email is already registered');
    });
  });

  describe('Login & User Enumeration Protection', () => {
    it('returns generic error on wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'customer1@brightloop.io',
          password: 'WrongPassword#999',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('returns identical generic error on non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'nonexistent@brightloop.io',
          password: 'AnyPassword#123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('Profile & Current User (/api/auth/me)', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns user profile when authenticated with access cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('customer1@brightloop.io');
      expect(res.body.data.user.role).toBe('CUSTOMER');
      expect(res.body.data.user.companyName).toBe('Acme Corp');
    });
  });

  describe('Token Refresh Rotation & Family Reuse Revocation', () => {
    it('rotates refresh token and issues fresh access token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', `refresh_token=${customerRefreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'] as string[];
      const newRefreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
      const newRefreshToken = newRefreshCookie?.split(';')[0]?.replace('refresh_token=', '') || '';

      expect(newRefreshToken).not.toBe(customerRefreshToken);

      // Replaying the old (now revoked) refresh token must trigger Token Reuse Detection
      const replayRes = await request(app)
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', `refresh_token=${customerRefreshToken}`);

      expect(replayRes.status).toBe(403);
      expect(replayRes.body.error.code).toBe('FORBIDDEN');
      expect(replayRes.body.error.message).toContain('Token reuse detected');

      // The new refresh token in the family must ALSO be revoked now!
      const subsequentRes = await request(app)
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', `refresh_token=${newRefreshToken}`);

      expect(subsequentRes.status).toBe(403);
    });
  });

  describe('Role-Based Access Control (RBAC) & Staff Provisioning', () => {
    it('rejects staff creation when attempted by Customer role (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', customerCookie)
        .send({
          email: 'rogue-staff@brightloop.io',
          password: 'StaffPassword#123',
          fullName: 'Rogue Staff',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Admin to create Staff user', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          email: 'support-staff@brightloop.io',
          password: 'StaffPassword#123',
          fullName: 'Bob Support',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.staff.role).toBe('STAFF');
      expect(res.body.data.staff.email).toBe('support-staff@brightloop.io');

      // Login as the new staff user
      const staffLogin = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'support-staff@brightloop.io',
          password: 'StaffPassword#123',
        });

      expect(staffLogin.status).toBe(200);
      staffCookie = staffLogin.headers['set-cookie']
        .find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';
    });

    it('rejects staff creation when attempted by Staff role (Admin-only enforcement)', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', staffCookie)
        .send({
          email: 'another-staff@brightloop.io',
          password: 'StaffPassword#123',
          fullName: 'Another Staff',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Admin to list system users with pagination', async () => {
      const res = await request(app)
        .get('/api/users?role=STAFF')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('page', 1);
    });
  });
});
