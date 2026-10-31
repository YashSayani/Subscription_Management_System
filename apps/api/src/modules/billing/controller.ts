import { Request, Response } from 'express';
import { prisma } from '@brightloop/database';
import { sendSuccess } from '../../common/response.js';
import { BillingEngine } from './engine.js';

export class BillingController {
  static async runCycle(req: Request, res: Response) {
    const batchSize = typeof req.query.batchSize === 'string' ? parseInt(req.query.batchSize, 10) : 25;
    const result = await BillingEngine.runBillingCycle(batchSize);
    sendSuccess(res, { result, message: 'Billing cycle run completed' });
  }

  static async listAttempts(req: Request, res: Response) {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const attempts = await prisma.billingAttempt.findMany({
      take: limit,
      orderBy: { attemptDate: 'desc' },
      include: {
        subscription: {
          select: { subscriptionNumber: true, status: true },
        },
        invoice: {
          select: { invoiceNumber: true, totalAmount: true },
        },
      },
    });

    sendSuccess(res, { attempts });
  }
}
