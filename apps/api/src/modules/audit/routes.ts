import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate.js';
import { auditQuerySchema } from './schema.js';
import * as auditController from './controller.js';

export const auditRouter = Router();

// All audit log routes require Admin authentication
auditRouter.use(authenticate, requireAdmin);

auditRouter.get(
  '/',
  validateRequest({ query: auditQuerySchema }),
  asyncHandler(auditController.getAuditLogs),
);
