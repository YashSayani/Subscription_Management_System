import { Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import { AnalyticsService } from './service.js';

export class AnalyticsController {
  static async getOverview(_req: Request, res: Response): Promise<void> {
    const overview = await AnalyticsService.getOverview();
    sendSuccess(res, overview, 200);
  }

  static async getAgingReport(_req: Request, res: Response): Promise<void> {
    const aging = await AnalyticsService.getAgingReport();
    sendSuccess(res, aging, 200);
  }

  static async getRevenueTrends(_req: Request, res: Response): Promise<void> {
    const trends = await AnalyticsService.getRevenueTrends();
    sendSuccess(res, trends, 200);
  }
}
