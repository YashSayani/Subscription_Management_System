import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { SubscriptionController } from './controller.js';
import {
  createSubscriptionSchema,
  transitionSubscriptionSchema,
  createQuotationTemplateSchema,
} from './schema.js';

const router = Router();

router.use(authenticate);

// Templates
router.get(
  '/templates',
  requirePermission('VIEW_CATALOG'),
  asyncHandler(SubscriptionController.listTemplates),
);

router.post(
  '/templates',
  requirePermission('MANAGE_CATALOG'),
  validateRequest({ body: createQuotationTemplateSchema }),
  asyncHandler(SubscriptionController.createTemplate),
);

// Subscriptions & Quotations
router.get(
  '/',
  requirePermission('VIEW_SUBSCRIPTION'),
  asyncHandler(SubscriptionController.listSubscriptions),
);

router.get(
  '/:id',
  requirePermission('VIEW_SUBSCRIPTION'),
  asyncHandler(SubscriptionController.getSubscription),
);

router.post(
  '/',
  requirePermission('CREATE_QUOTATION'),
  validateRequest({ body: createSubscriptionSchema }),
  asyncHandler(SubscriptionController.createSubscription),
);

router.post(
  '/:id/transition',
  validateRequest({ body: transitionSubscriptionSchema }),
  asyncHandler(SubscriptionController.transitionSubscription),
);

router.post(
  '/:id/confirm',
  requirePermission('CONFIRM_QUOTATION'),
  asyncHandler(SubscriptionController.confirmQuote),
);

export const subscriptionRoutes = router;
