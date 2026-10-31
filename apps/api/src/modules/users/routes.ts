import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin, requireStaffOrAdmin } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createStaffSchema,
  createCustomerSchema,
  userQuerySchema,
  updateProfileSchema,
  creditHistoryQuerySchema,
} from './schema.js';
import * as usersController from './controller.js';

export const usersRouter = Router();

// All routes require authentication
usersRouter.use(authenticate);

// Self-service profile routes (any authenticated user)
usersRouter.get('/profile', asyncHandler(usersController.getProfile));
usersRouter.patch(
  '/profile',
  validateRequest({ body: updateProfileSchema }),
  asyncHandler(usersController.updateProfile),
);

// Credit history ledger (Customers view their own, Staff/Admin can view any)
usersRouter.get(
  '/credit-history',
  validateRequest({ query: creditHistoryQuerySchema }),
  asyncHandler(usersController.getCreditHistory),
);

// Admin-only staff provisioning
usersRouter.post(
  '/staff',
  requireAdmin,
  validateRequest({ body: createStaffSchema }),
  asyncHandler(usersController.createStaff),
);

// Admin & Staff customer onboarding
usersRouter.post(
  '/customers',
  requireStaffOrAdmin,
  validateRequest({ body: createCustomerSchema }),
  asyncHandler(usersController.createCustomer),
);

// Staff and Admin can list/search users
usersRouter.get(
  '/',
  requireStaffOrAdmin,
  validateRequest({ query: userQuerySchema }),
  asyncHandler(usersController.getUsers),
);
