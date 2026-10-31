import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma, Role } from '@brightloop/database';
import { env } from '../../config/env.js';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '../../common/errors.js';
import { RegisterInput, LoginInput } from './schema.js';
import { AuthUser } from '../../common/types.js';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const hashToken = (rawToken: string): string => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

export const generateAccessToken = (user: AuthUser): string => {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
};

export const createTokenPair = async (
  userId: string,
  email: string,
  role: Role,
  fullName: string,
  familyId?: string,
): Promise<TokenPair> => {
  const authUser: AuthUser = { userId, email, role, fullName };
  const accessToken = generateAccessToken(authUser);

  // Generate cryptographically random refresh token
  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);
  const activeFamilyId = familyId || crypto.randomUUID();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      familyId: activeFamilyId,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: authUser,
  };
};

export const registerCustomer = async (input: RegisterInput): Promise<TokenPair> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new ConflictError('Email is already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Role is strictly hardcoded to CUSTOMER on registration (mass-assignment protection)
  const newUser = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      companyName: input.companyName,
      taxId: input.taxId,
      billingAddress: input.billingAddress,
      role: Role.CUSTOMER,
      creditBalance: 0.0,
      isActive: true,
    },
  });

  return createTokenPair(newUser.id, newUser.email, newUser.role, newUser.fullName);
};

export const loginUser = async (input: LoginInput): Promise<TokenPair> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  // Generic error to prevent username/email enumeration
  if (!user || !user.isActive || user.deletedAt) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return createTokenPair(user.id, user.email, user.role, user.fullName);
};

export const rotateRefreshToken = async (rawRefreshToken: string): Promise<TokenPair> => {
  const tokenHash = hashToken(rawRefreshToken);

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existingToken) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Token Reuse Detection: If token is already revoked, potential token theft!
  // Invalidate the entire token family immediately for security.
  if (existingToken.isRevoked) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existingToken.familyId },
      data: { isRevoked: true },
    });
    throw new ForbiddenError('Token reuse detected. All sessions in this family have been revoked.');
  }

  // Check if token has expired
  if (new Date() > existingToken.expiresAt) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  if (!existingToken.user.isActive || existingToken.user.deletedAt) {
    throw new UnauthorizedError('User account is inactive or disabled');
  }

  // Revoke the current refresh token
  await prisma.refreshToken.update({
    where: { id: existingToken.id },
    data: { isRevoked: true },
  });

  // Issue new token pair preserving the familyId
  return createTokenPair(
    existingToken.user.id,
    existingToken.user.email,
    existingToken.user.role,
    existingToken.user.fullName,
    existingToken.familyId,
  );
};

export const logoutUser = async (rawRefreshToken?: string): Promise<void> => {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { isRevoked: true },
  });
};

export const getCurrentUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      companyName: true,
      taxId: true,
      billingAddress: true,
      creditBalance: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User profile not found or inactive');
  }

  return user;
};
