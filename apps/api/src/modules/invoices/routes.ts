import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { InvoiceController } from './controller.js';
import { listInvoicesQuerySchema, cancelInvoiceSchema, applyInvoiceDiscountSchema } from './schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('VIEW_INVOICE'),
  validateRequest({ query: listInvoicesQuerySchema }),
  asyncHandler(InvoiceController.listInvoices),
);

router.get(
  '/:id',
  requirePermission('VIEW_INVOICE'),
  asyncHandler(InvoiceController.getInvoice),
);

router.get(
  '/:id/print',
  requirePermission('VIEW_INVOICE'),
  asyncHandler(InvoiceController.printInvoice),
);

router.post(
  '/:id/cancel',
  requirePermission('VOID_INVOICE'),
  validateRequest({ body: cancelInvoiceSchema }),
  asyncHandler(InvoiceController.cancelInvoice),
);

router.post(
  '/:id/apply-discount',
  requirePermission('APPLY_DISCOUNT'),
  validateRequest({ body: applyInvoiceDiscountSchema }),
  asyncHandler(InvoiceController.applyDiscount),
);

export const invoiceRoutes = router;
