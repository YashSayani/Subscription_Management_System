import { Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import * as usersService from './service.js';
import { UserQueryInput } from './schema.js';

export const createStaff = async (req: Request, res: Response): Promise<void> => {
  const staff = await usersService.createStaffUser(req.body);
  sendSuccess(res, { staff }, 201);
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as UserQueryInput;
  const result = await usersService.listUsers(query);
  sendSuccess(res, result.users, 200, result.pagination);
};
