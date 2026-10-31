import { Request, Response } from 'express';
import { UserRole } from '@brightloop/shared';
import { BillingFrequency } from '@brightloop/database';
import { sendSuccess } from '../../common/response.js';
import { CatalogService } from './service.js';
import {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  CreatePlanInput,
  UpdatePlanInput,
  CalculatePriceInput,
} from './schema.js';

export class CatalogController {
  // Products
  static async listProducts(req: Request, res: Response) {
    const isAdminOrStaff = req.user && (req.user.role === UserRole.ADMIN || req.user.role === UserRole.STAFF);
    const includeArchived = isAdminOrStaff && req.query.includeArchived === 'true';
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const products = await CatalogService.listProducts({
      includeArchived,
      type,
      search,
    });

    sendSuccess(res, { products });
  }

  static async getProduct(req: Request, res: Response) {
    const isAdminOrStaff = req.user && (req.user.role === UserRole.ADMIN || req.user.role === UserRole.STAFF);
    const includeArchived = isAdminOrStaff && req.query.includeArchived === 'true';

    const product = await CatalogService.getProductById(req.params.id, includeArchived);
    sendSuccess(res, { product });
  }

  static async createProduct(req: Request, res: Response) {
    const product = await CatalogService.createProduct(req.body as CreateProductInput);
    sendSuccess(res, { product }, 201);
  }

  static async updateProduct(req: Request, res: Response) {
    const product = await CatalogService.updateProduct(req.params.id, req.body as UpdateProductInput);
    sendSuccess(res, { product });
  }

  static async deleteProduct(req: Request, res: Response) {
    await CatalogService.deleteProduct(req.params.id);
    sendSuccess(res, { message: 'Product successfully archived' });
  }

  // Variants
  static async addVariant(req: Request, res: Response) {
    const variant = await CatalogService.addVariant(req.params.id, req.body as CreateVariantInput);
    sendSuccess(res, { variant }, 201);
  }

  static async updateVariant(req: Request, res: Response) {
    const variant = await CatalogService.updateVariant(req.params.id, req.body as UpdateVariantInput);
    sendSuccess(res, { variant });
  }

  static async deleteVariant(req: Request, res: Response) {
    await CatalogService.deleteVariant(req.params.id);
    sendSuccess(res, { message: 'Variant successfully archived' });
  }

  // Plans
  static async listPlans(req: Request, res: Response) {
    const isAdminOrStaff = req.user && (req.user.role === UserRole.ADMIN || req.user.role === UserRole.STAFF);
    const includeArchived = isAdminOrStaff && req.query.includeArchived === 'true';
    const frequency = req.query.frequency as BillingFrequency | undefined;

    const plans = await CatalogService.listPlans({
      includeArchived,
      frequency,
    });

    sendSuccess(res, { plans });
  }

  static async getPlan(req: Request, res: Response) {
    const isAdminOrStaff = req.user && (req.user.role === UserRole.ADMIN || req.user.role === UserRole.STAFF);
    const includeArchived = isAdminOrStaff && req.query.includeArchived === 'true';

    const plan = await CatalogService.getPlanById(req.params.id, includeArchived);
    sendSuccess(res, { plan });
  }

  static async createPlan(req: Request, res: Response) {
    const plan = await CatalogService.createPlan(req.body as CreatePlanInput);
    sendSuccess(res, { plan }, 201);
  }

  static async updatePlan(req: Request, res: Response) {
    const plan = await CatalogService.updatePlan(req.params.id, req.body as UpdatePlanInput);
    sendSuccess(res, { plan });
  }

  static async deletePlan(req: Request, res: Response) {
    await CatalogService.deletePlan(req.params.id);
    sendSuccess(res, { message: 'Plan successfully archived' });
  }

  // Price calculation
  static async calculatePrice(req: Request, res: Response) {
    const calculation = await CatalogService.calculatePrice(req.body as CalculatePriceInput);
    sendSuccess(res, { calculation });
  }
}
