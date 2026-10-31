import { Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import { DiscountService } from './service.js';
import {
  CreateDiscountInput,
  UpdateDiscountInput,
  ValidateDiscountInput,
  ListDiscountsQuery,
} from './schema.js';

export class DiscountController {
  static async createDiscount(req: Request, res: Response): Promise<void> {
    const discount = await DiscountService.createDiscount(req.body as CreateDiscountInput);
    sendSuccess(res, discount, 201);
  }

  static async updateDiscount(req: Request, res: Response): Promise<void> {
    const discount = await DiscountService.updateDiscount(
      req.params.id,
      req.body as UpdateDiscountInput,
    );
    sendSuccess(res, discount, 200);
  }

  static async listDiscounts(req: Request, res: Response): Promise<void> {
    const result = await DiscountService.listDiscounts(
      req.query as unknown as ListDiscountsQuery,
    );
    sendSuccess(res, result.discounts, 200, result.meta);
  }

  static async getDiscountById(req: Request, res: Response): Promise<void> {
    const discount = await DiscountService.getDiscountById(req.params.id);
    sendSuccess(res, discount, 200);
  }

  static async validateDiscount(req: Request, res: Response): Promise<void> {
    const result = await DiscountService.validateDiscount(req.body as ValidateDiscountInput);
    sendSuccess(res, result, 200);
  }
}
