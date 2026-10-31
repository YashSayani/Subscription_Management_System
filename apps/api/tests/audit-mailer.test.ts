import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { app } from '../src/app.js';
import { prisma, Role } from '@brightloop/database';
import { mailer } from '../src/common/mailer.js';

describe('Password Reset, Audit Logs & Mock Mailer Module', () => {
  let adminCookie: string;
  let staffCookie: string;
  let customerCookie: string;

  let customerId: string;
  const customerEmail = 'reset-user@brightloop.io';

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
    mailer.clearSentEmails();

    // 1. Create Admin
    const adminPasswordHash = await bcrypt.hash('AdminPass#123', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'audit-admin@brightloop.io',
        passwordHash: adminPasswordHash,
        fullName: 'Audit Admin',
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
        email: 'audit-staff@brightloop.io',
        passwordHash: staffPasswordHash,
        fullName: 'Audit Staff',
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
    const custPasswordHash = await bcrypt.hash('OldPassword#123', 12);
    const cust = await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash: custPasswordHash,
        fullName: 'Reset Customer',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });
    customerId = cust.id;

    const custLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: cust.email, password: 'OldPassword#123' });
    customerCookie =
      custLogin.headers['set-cookie']
        ?.find((c: string) => c.startsWith('access_token='))
        ?.split(';')[0] || '';
  });

  afterAll(async () => {
    await cleanupDb();
    mailer.clearSentEmails();
    await prisma.$disconnect();
  });

  describe('1. Password Recovery Flow & Mock Mailer', () => {
    let capturedRawToken: string;

    it('returns generic success and dispatches email with token when email exists', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: customerEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('If this email is registered');

      // Verify email was dispatched via Mock Mailer
      const lastEmail = mailer.getLastEmail();
      expect(lastEmail).toBeDefined();
      expect(lastEmail?.to).toBe(customerEmail);
      expect(lastEmail?.subject).toContain('Reset your Brightloop account password');
      expect(lastEmail?.text).toContain('token=');

      // Extract raw token from reset link in email
      const tokenMatch = lastEmail?.text?.match(/token=([a-f0-9]+)/);
      expect(tokenMatch).not.toBeNull();
      capturedRawToken = tokenMatch![1];
      expect(capturedRawToken.length).toBe(64); // 32 bytes in hex = 64 characters

      // Verify database has SHA-256 hash, NOT raw token
      const expectedHash = crypto.createHash('sha256').update(capturedRawToken).digest('hex');
      const dbUser = await prisma.user.findUnique({ where: { id: customerId } });
      expect(dbUser?.passwordResetToken).toBe(expectedHash);
      expect(dbUser?.passwordResetExpiresAt).toBeDefined();
      expect(new Date(dbUser!.passwordResetExpiresAt!).getTime()).toBeGreaterThan(Date.now());
    });

    it('returns identical generic success without dispatching email for unregistered email (prevents enumeration)', async () => {
      mailer.clearSentEmails();

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: 'nonexistent-user@brightloop.io' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('If this email is registered');

      // No email should be sent
      expect(mailer.getSentEmails()).toHaveLength(0);
    });

    it('rejects password reset with invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          token: 'invalid-token-1234567890abcdef',
          newPassword: 'BrandNewPassword#999',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid or expired password reset token');
    });

    it('rejects password reset with weak password (< 9 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          token: capturedRawToken,
          newPassword: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects password reset when token has expired', async () => {
      // Artificially expire the token in DB
      await prisma.user.update({
        where: { id: customerId },
        data: {
          passwordResetExpiresAt: new Date(Date.now() - 60000), // 1 minute ago
        },
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          token: capturedRawToken,
          newPassword: 'BrandNewPassword#999',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid or expired password reset token');
    });

    it('successfully resets password with valid token and revokes active sessions', async () => {
      // 1. Request fresh password reset
      await request(app)
        .post('/api/auth/forgot-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: customerEmail });

      const lastEmail = mailer.getLastEmail();
      const tokenMatch = lastEmail?.text?.match(/token=([a-f0-9]+)/);
      const validToken = tokenMatch![1];

      // 2. Perform password reset
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          token: validToken,
          newPassword: 'BrandNewPassword#999',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.data.message).toContain('Password has been successfully reset');

      // 3. Verify in database: reset token is cleared
      const dbUser = await prisma.user.findUnique({ where: { id: customerId } });
      expect(dbUser?.passwordResetToken).toBeNull();
      expect(dbUser?.passwordResetExpiresAt).toBeNull();

      // 4. Verify all refresh tokens for this user are revoked
      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: customerId, isRevoked: false },
      });
      expect(activeTokens).toHaveLength(0);

      // 5. Old password must fail login
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: customerEmail, password: 'OldPassword#123' });
      expect(oldLoginRes.status).toBe(401);

      // 6. New password must succeed login
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: customerEmail, password: 'BrandNewPassword#999' });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.data.user.email).toBe(customerEmail);

      // 7. Single-use token check: immediate re-use must fail
      const reuseRes = await request(app)
        .post('/api/auth/reset-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          token: validToken,
          newPassword: 'AnotherPassword#999',
        });
      expect(reuseRes.status).toBe(400);
    });
  });

  describe('2. Administrative Audit Logs Engine', () => {
    it('rejects unauthenticated request to /api/audit-logs with 401', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(401);
    });

    it('rejects Customer role from accessing audit logs with 403', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', customerCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(403);
    });

    it('rejects Staff role from accessing audit logs with 403', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', staffCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(403);
    });

    it('allows Admin to query paginated audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

      // Ensure logs contain actor and action details
      const firstLog = res.body.data[0];
      expect(firstLog.id).toBeDefined();
      expect(firstLog.action).toBeDefined();
      expect(firstLog.entityType).toBeDefined();
      expect(firstLog.createdAt).toBeDefined();
    });

    it('allows Admin to filter audit logs by action', async () => {
      const res = await request(app)
        .get('/api/audit-logs?action=PASSWORD_RESET_COMPLETED')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((log: { action: string }) => {
        expect(log.action).toBe('PASSWORD_RESET_COMPLETED');
      });
    });

    it('allows Admin to filter audit logs by entityType', async () => {
      const res = await request(app)
        .get('/api/audit-logs?entityType=User')
        .set('Cookie', adminCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((log: { entityType: string }) => {
        expect(log.entityType).toBe('User');
      });
    });
  });
});
