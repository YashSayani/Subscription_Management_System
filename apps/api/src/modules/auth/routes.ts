import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { registerSchema, loginSchema } from './schema.js';
import * as authController from './controller.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  validateRequest({ body: registerSchema }),
  asyncHandler(authController.register),
);

authRouter.post(
  '/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.login),
);

authRouter.post('/refresh', asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
