import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../common/logger.js';
import { env } from '../config/env.js';
import { AppError } from '../common/errors.js';
import { sendError } from '../common/response.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    sendError(
      res,
      'VALIDATION_ERROR',
      'Request payload validation failed',
      err.flatten().fieldErrors,
      400,
    );
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({
        err,
        path: req.path,
        method: req.method,
      });
    }

    sendError(res, err.code, err.message, err.details, err.statusCode);
    return;
  }

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message =
    statusCode === 500 && env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'An unexpected error occurred';

  logger.error({
    err,
    path: req.path,
    method: req.method,
    statusCode,
  });

  const details = env.NODE_ENV !== 'production' ? { stack: err.stack } : undefined;

  sendError(res, err.code || 'INTERNAL_SERVER_ERROR', message, details, statusCode);
};
