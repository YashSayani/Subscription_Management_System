import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { subscriptionRoutes } from './modules/subscriptions/routes.js';
import { billingRoutes } from './modules/billing/routes.js';
import { invoiceRoutes } from './modules/invoices/routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { csrfProtection } from './middleware/csrf.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { sendError } from './common/response.js';

export const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Global Rate Limiting (bypassed in test environment)
if (env.NODE_ENV !== 'test') {
  app.use(globalLimiter);
}

// Body parsing with size limit
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Anti-CSRF protection on all state-changing endpoints
app.use(csrfProtection);

// HTTP Request logging
if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health',
      },
    }),
  );
}

// API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/catalog', catalogRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/invoices', invoiceRoutes);

// 404 Route Handler
app.use((_req, res) => {
  sendError(res, 'NOT_FOUND', 'The requested API route was not found', undefined, 404);
});

// Centralized Error Handling Middleware
app.use(errorHandler);
