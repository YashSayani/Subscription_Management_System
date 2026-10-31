import { Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import * as auditService from './service.js';
import { AuditQueryInput } from './schema.js';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as AuditQueryInput;
  const result = await auditService.listAuditLogs(query);
  sendSuccess(res, result.logs, 200, result.pagination);
};
