import { Request, Response } from 'express';
import { UserRole } from '@brightloop/shared';
import { sendSuccess } from '../../common/response.js';
import { PaymentService } from './service.js';
import { RecordPaymentInput, ApplyCreditInput, ListPaymentsQuery } from './schema.js';

export class PaymentController {
  static async recordPayment(req: Request, res: Response): Promise<void> {
    const result = await PaymentService.recordPayment(
      req.user!.userId,
      req.user!.role,
      req.body as RecordPaymentInput,
    );
    sendSuccess(res, result, 201);
  }

  static async applyCredit(req: Request, res: Response): Promise<void> {
    const result = await PaymentService.applyCredit(
      req.user!.userId,
      req.user!.role,
      req.user!.role as UserRole,
      req.body as ApplyCreditInput,
    );
    sendSuccess(res, result, 200);
  }

  static async listPayments(req: Request, res: Response): Promise<void> {
    const result = await PaymentService.listPayments(
      { id: req.user!.userId, role: req.user!.role as UserRole },
      req.query as unknown as ListPaymentsQuery,
    );
    sendSuccess(res, result.payments, 200, result.meta);
  }

  static async getPaymentById(req: Request, res: Response): Promise<void> {
    const result = await PaymentService.getPaymentById(
      { id: req.user!.userId, role: req.user!.role as UserRole },
      req.params.id,
    );
    sendSuccess(res, result, 200);
  }
}
