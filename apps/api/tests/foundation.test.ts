import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../src/middleware/validate.js';
import { csrfProtection } from '../src/middleware/csrf.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../src/common/errors.js';
import { sendSuccess } from '../src/common/response.js';

describe('Backend Foundation & Middlewares', () => {
  let testApp: express.Express;

  beforeAll(() => {
    testApp = express();
    testApp.use(express.json());
    testApp.use(csrfProtection);

    // Test route for CSRF & Success
    testApp.post('/test/csrf', (_req: Request, res: Response) => {
      sendSuccess(res, { message: 'CSRF Verified' }, 201);
    });

    // Test route for Zod Validation
    const testValidationSchema = {
      body: z.object({
        email: z.string().email('Invalid email address'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      }),
      query: z.object({
        view: z.enum(['full', 'compact']).optional(),
      }),
    };

    testApp.post(
      '/test/validation',
      validateRequest(testValidationSchema),
      (req: Request, res: Response) => {
        sendSuccess(res, { echo: req.body, query: req.query });
      },
    );

    // Test routes for custom AppErrors
    testApp.get('/test/errors/not-found', () => {
      throw new NotFoundError('Invoice not found');
    });

    testApp.get('/test/errors/unauthorized', () => {
      throw new UnauthorizedError('Session expired');
    });

    testApp.get('/test/errors/forbidden', () => {
      throw new ForbiddenError('Insufficient permissions');
    });

    testApp.get('/test/errors/bad-request', () => {
      throw new BadRequestError('Invalid filter query', { field: 'filter' });
    });

    testApp.get('/test/errors/conflict', () => {
      throw new ConflictError('Email already registered');
    });

    testApp.use(errorHandler);
  });

  describe('Anti-CSRF Middleware', () => {
    it('allows GET requests without custom headers', async () => {
      const res = await request(testApp).get('/test/errors/not-found');
      expect(res.status).toBe(404);
    });

    it('rejects POST request when missing custom header', async () => {
      const res = await request(testApp).post('/test/csrf').send({ test: true });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('CSRF protection');
    });

    it('allows POST request with X-Requested-With header', async () => {
      const res = await request(testApp)
        .post('/test/csrf')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ test: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('CSRF Verified');
    });

    it('allows POST request with X-CSRF-Token header', async () => {
      const res = await request(testApp)
        .post('/test/csrf')
        .set('X-CSRF-Token', 'custom-csrf-token')
        .send({ test: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Zod Validation Middleware', () => {
    it('passes and returns 200 when payload is valid', async () => {
      const res = await request(testApp)
        .post('/test/validation?view=compact')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'valid@brightloop.io',
          quantity: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.echo.email).toBe('valid@brightloop.io');
      expect(res.body.data.echo.quantity).toBe(5);
      expect(res.body.data.query.view).toBe('compact');
    });

    it('returns 400 with structured field errors when payload is invalid', async () => {
      const res = await request(testApp)
        .post('/test/validation')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          email: 'invalid-email-format',
          quantity: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toHaveProperty('email');
      expect(res.body.error.details).toHaveProperty('quantity');
      expect(res.body.error.details.email).toContain('Invalid email address');
      expect(res.body.error.details.quantity).toContain('Quantity must be at least 1');
    });
  });

  describe('Custom AppError Hierarchy & Error Handling', () => {
    it('handles NotFoundError with 404 status and NOT_FOUND code', async () => {
      const res = await request(testApp).get('/test/errors/not-found');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        },
      });
    });

    it('handles UnauthorizedError with 401 status and UNAUTHORIZED code', async () => {
      const res = await request(testApp).get('/test/errors/unauthorized');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Session expired');
    });

    it('handles ForbiddenError with 403 status and FORBIDDEN code', async () => {
      const res = await request(testApp).get('/test/errors/forbidden');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Insufficient permissions');
    });

    it('handles BadRequestError with 400 status and details payload', async () => {
      const res = await request(testApp).get('/test/errors/bad-request');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.details).toEqual({ field: 'filter' });
    });

    it('handles ConflictError with 409 status and CONFLICT code', async () => {
      const res = await request(testApp).get('/test/errors/conflict');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('Email already registered');
    });
  });
});
