import { Request, Response } from 'express';
import { SubscriptionStatus } from '@brightloop/database';
import { sendSuccess } from '../../common/response.js';
import { SubscriptionService } from './service.js';
import {
  CreateSubscriptionInput,
  TransitionSubscriptionInput,
  CreateQuotationTemplateInput,
} from './schema.js';

export class SubscriptionController {
  static async createSubscription(req: Request, res: Response) {
    const subscription = await SubscriptionService.createSubscription(
      req.body as CreateSubscriptionInput,
      req.user!,
    );
    sendSuccess(res, { subscription }, 201);
  }

  static async listSubscriptions(req: Request, res: Response) {
    const status = req.query.status as SubscriptionStatus | undefined;
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const subscriptions = await SubscriptionService.listSubscriptions(
      { customerId, status, planId, search },
      req.user!,
    );

    sendSuccess(res, { subscriptions });
  }

  static async getSubscription(req: Request, res: Response) {
    const subscription = await SubscriptionService.getSubscriptionById(
      req.params.id,
      req.user!,
    );
    sendSuccess(res, { subscription });
  }

  static async transitionSubscription(req: Request, res: Response) {
    const subscription = await SubscriptionService.transitionSubscription(
      req.params.id,
      req.body as TransitionSubscriptionInput,
      req.user!,
    );
    sendSuccess(res, { subscription });
  }

  static async confirmQuote(req: Request, res: Response) {
    const subscription = await SubscriptionService.transitionSubscription(
      req.params.id,
      { action: 'CONFIRM' },
      req.user!,
    );
    sendSuccess(res, { subscription, message: 'Quotation confirmed successfully' });
  }

  // Templates
  static async listTemplates(_req: Request, res: Response) {
    const templates = await SubscriptionService.listTemplates();
    sendSuccess(res, { templates });
  }

  static async createTemplate(req: Request, res: Response) {
    const template = await SubscriptionService.createTemplate(
      req.body as CreateQuotationTemplateInput,
    );
    sendSuccess(res, { template }, 201);
  }
}
