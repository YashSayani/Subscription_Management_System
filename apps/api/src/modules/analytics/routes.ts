import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { AnalyticsController } from './controller.js';

const router = Router();

router.use(authenticate);

router.get(
  '/overview',
  requirePermission('VIEW_ANALYTICS'),
  asyncHandler(AnalyticsController.getOverview),
);

router.get(
  '/aging',
  requirePermission('VIEW_ANALYTICS'),
  asyncHandler(AnalyticsController.getAgingReport),
);

router.get(
  '/revenue-trends',
  requirePermission('VIEW_ANALYTICS'),
  asyncHandler(AnalyticsController.getRevenueTrends),
);

export const analyticsRoutes = router;
