import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { BillingController } from './controller.js';

const router = Router();

router.use(authenticate);

router.post(
  '/run-worker',
  requirePermission('MANAGE_SUBSCRIPTION'),
  asyncHandler(BillingController.runCycle),
);

router.get(
  '/attempts',
  requirePermission('VIEW_ANALYTICS'),
  asyncHandler(BillingController.listAttempts),
);

export const billingRoutes = router;
