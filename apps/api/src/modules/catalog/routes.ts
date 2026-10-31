import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { CatalogController } from './controller.js';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  createPlanSchema,
  updatePlanSchema,
  calculatePriceSchema,
} from './schema.js';

const router = Router();

// All catalog operations require authentication
router.use(authenticate);

// ===================== PRODUCTS =====================
router.get(
  '/products',
  requirePermission('VIEW_CATALOG'),
  asyncHandler(CatalogController.listProducts),
);

router.get(
  '/products/:id',
  requirePermission('VIEW_CATALOG'),
  asyncHandler(CatalogController.getProduct),
);

router.post(
  '/products',
  requirePermission('MANAGE_CATALOG'),
  validateRequest({ body: createProductSchema }),
  asyncHandler(CatalogController.createProduct),
);

router.patch(
  '/products/:id',
  requirePermission('MANAGE_CATALOG'),
  validateRequest({ body: updateProductSchema }),
  asyncHandler(CatalogController.updateProduct),
);

router.delete(
  '/products/:id',
  requirePermission('MANAGE_CATALOG'),
  asyncHandler(CatalogController.deleteProduct),
);

// ===================== PRODUCT VARIANTS =====================
router.post(
  '/products/:id/variants',
  requirePermission('MANAGE_CATALOG'),
  validateRequest({ body: createVariantSchema }),
  asyncHandler(CatalogController.addVariant),
);

router.patch(
  '/variants/:id',
  requirePermission('MANAGE_CATALOG'),
  validateRequest({ body: updateVariantSchema }),
  asyncHandler(CatalogController.updateVariant),
);

router.delete(
  '/variants/:id',
  requirePermission('MANAGE_CATALOG'),
  asyncHandler(CatalogController.deleteVariant),
);

// ===================== PLANS =====================
router.get(
  '/plans',
  requirePermission('VIEW_CATALOG'),
  asyncHandler(CatalogController.listPlans),
);

router.get(
  '/plans/:id',
  requirePermission('VIEW_CATALOG'),
  asyncHandler(CatalogController.getPlan),
);

router.post(
  '/plans',
  requirePermission('MANAGE_CATALOG'),
  validateRequest({ body: createPlanSchema }),
  asyncHandler(CatalogController.createPlan),
);

router.patch(
  '/plans/:id',
  requirePermission('MANAGE_CATALOG'),
  validateRequest({ body: updatePlanSchema }),
  asyncHandler(CatalogController.updatePlan),
);

router.delete(
  '/plans/:id',
  requirePermission('MANAGE_CATALOG'),
  asyncHandler(CatalogController.deletePlan),
);

// ===================== PRICE CALCULATOR =====================
router.post(
  '/calculate-price',
  requirePermission('VIEW_CATALOG'),
  validateRequest({ body: calculatePriceSchema }),
  asyncHandler(CatalogController.calculatePrice),
);

export const catalogRoutes = router;
