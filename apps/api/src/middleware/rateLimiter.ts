import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { sendError } from '../common/response.js';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(
      res,
      'AUTH_RATE_LIMIT_EXCEEDED',
      'Too many authentication attempts from this IP, please try again in 15 minutes',
      undefined,
      429,
    );
  },
});
