import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate.js';
import { createStaffSchema, userQuerySchema } from './schema.js';
import * as usersController from './controller.js';

export const usersRouter = Router();

// All user management routes require ADMIN
usersRouter.use(authenticate, requireAdmin);

usersRouter.post(
  '/staff',
  validateRequest({ body: createStaffSchema }),
  asyncHandler(usersController.createStaff),
);

usersRouter.get(
  '/',
  validateRequest({ query: userQuerySchema }),
  asyncHandler(usersController.getUsers),
);
