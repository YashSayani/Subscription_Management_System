import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse } from '@brightloop/shared';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: Record<string, unknown>,
): Response => {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  details?: unknown,
  statusCode: number = 500,
): Response => {
  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
  return res.status(statusCode).json(payload);
};
