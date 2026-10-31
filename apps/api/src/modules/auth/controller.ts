import { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { sendSuccess } from '../../common/response.js';
import { UnauthorizedError } from '../../common/errors.js';
import * as authService from './service.js';

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

const setAuthCookies = (res: Response, tokenPair: authService.TokenPair) => {
  const isProduction = env.NODE_ENV === 'production';

  // 15-minute access token cookie
  res.cookie(ACCESS_COOKIE_NAME, tokenPair.accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  // 7-day refresh token cookie
  res.cookie(REFRESH_COOKIE_NAME, tokenPair.refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookies = (res: Response) => {
  const isProduction = env.NODE_ENV === 'production';
  res.clearCookie(ACCESS_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/',
  });
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/',
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const tokenPair = await authService.registerCustomer(req.body);
  setAuthCookies(res, tokenPair);

  sendSuccess(
    res,
    {
      user: tokenPair.user,
    },
    201,
  );
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const tokenPair = await authService.loginUser(req.body);
  setAuthCookies(res, tokenPair);

  sendSuccess(res, {
    user: tokenPair.user,
  });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  // Read refresh token from cookie or request body
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

  if (!rawRefreshToken) {
    throw new UnauthorizedError('Refresh token is missing');
  }

  const tokenPair = await authService.rotateRefreshToken(rawRefreshToken);
  setAuthCookies(res, tokenPair);

  sendSuccess(res, {
    user: tokenPair.user,
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
  await authService.logoutUser(rawRefreshToken);
  clearAuthCookies(res);

  sendSuccess(res, { message: 'Logged out successfully' });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const user = await authService.getCurrentUserProfile(req.user.userId);
  sendSuccess(res, { user });
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.requestPasswordReset(req.body.email);
  sendSuccess(res, result, 200);
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.resetPassword(req.body.token, req.body.newPassword);
  sendSuccess(res, result, 200);
};
