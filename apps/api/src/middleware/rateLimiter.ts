import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { sendError } from '../common/response.js';

const isDev = env.NODE_ENV === 'development';
const isTest = env.NODE_ENV === 'test';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 300, // 10,000 in dev for unrestricted testing, 300 in prod
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req: Request, res: Response) => {
    sendError(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests from this IP, please try again in 15 minutes',
      undefined,
      429,
    );
  },
});

export const authLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 15 * 60 * 1000, // 1 min in dev, 15 min in prod
  max: isDev ? 1000 : 30, // 1,000 attempts in dev for smooth testing, 30 in prod
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req: Request, res: Response) => {
    sendError(
      res,
      'AUTH_RATE_LIMIT_EXCEEDED',
      'Too many authentication attempts from this IP, please try again shortly',
      undefined,
      429,
    );
  },
});
