import { Request, Response } from 'express';
import { UserRole } from '@brightloop/shared';
import { sendSuccess } from '../../common/response.js';
import { ForbiddenError } from '../../common/errors.js';
import * as usersService from './service.js';
import { UserQueryInput, UpdateProfileBody } from './schema.js';

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  const actorId = req.user!.userId;
  const actorRole = req.user!.role;
  const result = await usersService.createCustomerUser(req.body, actorId, actorRole);
  sendSuccess(res, result, 201);
};

export const createStaff = async (req: Request, res: Response): Promise<void> => {
  const staff = await usersService.createStaffUser(req.body);
  sendSuccess(res, { staff }, 201);
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as UserQueryInput;
  const result = await usersService.listUsers(query);
  sendSuccess(res, result.users, 200, result.pagination);
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const profile = await usersService.getUserProfile(userId);
  sendSuccess(res, profile, 200);
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const body = req.body as UpdateProfileBody;
  const updatedProfile = await usersService.updateUserProfile(userId, body);
  sendSuccess(res, updatedProfile, 200);
};

export const getCreditHistory = async (req: Request, res: Response): Promise<void> => {
  const currentUserId = req.user!.userId;
  const currentUserRole = req.user!.role;
  const requestedCustomerId = req.query.customerId as string | undefined;

  let targetUserId = currentUserId;

  if (currentUserRole === UserRole.CUSTOMER) {
    if (requestedCustomerId && requestedCustomerId !== currentUserId) {
      throw new ForbiddenError('Customers cannot access other customer credit histories');
    }
    targetUserId = currentUserId;
  } else {
    // Admin and Staff can query any customer
    if (requestedCustomerId) {
      targetUserId = requestedCustomerId;
    }
  }

  const history = await usersService.getUserCreditHistory(targetUserId);
  sendSuccess(res, history, 200);
};
