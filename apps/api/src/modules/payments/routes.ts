import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { PaymentController } from './controller.js';
import {
  recordPaymentSchema,
  applyCreditSchema,
  listPaymentsQuerySchema,
} from './schema.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  requirePermission('RECORD_PAYMENT'),
  validateRequest({ body: recordPaymentSchema }),
  asyncHandler(PaymentController.recordPayment),
);

router.post(
  '/apply-credit',
  validateRequest({ body: applyCreditSchema }),
  asyncHandler(PaymentController.applyCredit),
);

router.get(
  '/',
  requirePermission('VIEW_PAYMENT'),
  validateRequest({ query: listPaymentsQuerySchema }),
  asyncHandler(PaymentController.listPayments),
);

router.get(
  '/:id',
  requirePermission('VIEW_PAYMENT'),
  asyncHandler(PaymentController.getPaymentById),
);

export const paymentRoutes = router;
