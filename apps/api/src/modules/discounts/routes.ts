import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { DiscountController } from './controller.js';
import {
  createDiscountSchema,
  updateDiscountSchema,
  validateDiscountSchema,
  listDiscountsQuerySchema,
} from './schema.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  requirePermission('MANAGE_DISCOUNTS'),
  validateRequest({ body: createDiscountSchema }),
  asyncHandler(DiscountController.createDiscount),
);

router.get(
  '/',
  requirePermission('MANAGE_DISCOUNTS'),
  validateRequest({ query: listDiscountsQuerySchema }),
  asyncHandler(DiscountController.listDiscounts),
);

router.get(
  '/:id',
  requirePermission('MANAGE_DISCOUNTS'),
  asyncHandler(DiscountController.getDiscountById),
);

router.patch(
  '/:id',
  requirePermission('MANAGE_DISCOUNTS'),
  validateRequest({ body: updateDiscountSchema }),
  asyncHandler(DiscountController.updateDiscount),
);

router.post(
  '/validate',
  requirePermission('APPLY_DISCOUNT'),
  validateRequest({ body: validateDiscountSchema }),
  asyncHandler(DiscountController.validateDiscount),
);

export const discountRoutes = router;
