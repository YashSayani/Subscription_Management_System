import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma, Role } from '@brightloop/database';
import { env } from '../../config/env.js';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from '../../common/errors.js';
import { mailer } from '../../common/mailer.js';
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

  // Generate 64-byte crypto random string for refresh token
  const rawRefreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);
  const tokenFamily = familyId || crypto.randomUUID();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      familyId: tokenFamily,
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

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: Role.CUSTOMER,
      companyName: input.companyName,
      taxId: input.taxId,
      billingAddress: input.billingAddress,
      isActive: true,
    },
  });

  return createTokenPair(user.id, user.email, user.role, user.fullName);
};

export const loginUser = async (input: LoginInput): Promise<TokenPair> => {
  // Generic error message prevents account enumeration
  const invalidCredentialsError = new UnauthorizedError('Invalid email or password');

  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !user.isActive || user.deletedAt) {
    throw invalidCredentialsError;
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw invalidCredentialsError;
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

  // Token Reuse Detection: If an already revoked token is used, invalidate its entire token family
  if (existingToken.isRevoked) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existingToken.familyId },
      data: { isRevoked: true },
    });
    throw new ForbiddenError('Token reuse detected. All sessions in this family have been revoked.');
  }

  // Check expiration
  if (existingToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  // Revoke current token
  await prisma.refreshToken.update({
    where: { id: existingToken.id },
    data: { isRevoked: true },
  });

  const { user } = existingToken;
  if (!user || !user.isActive || user.deletedAt) {
    throw new UnauthorizedError('User account is inactive or disabled');
  }

  // Issue new pair preserving familyId
  return createTokenPair(user.id, user.email, user.role, user.fullName, existingToken.familyId);
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

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Always return identical generic message to prevent account enumeration
  const genericResponse = {
    message: 'If this email is registered in our system, a password reset link has been sent.',
  };

  if (!user || !user.isActive || user.deletedAt) {
    return genericResponse;
  }

  // Generate 32-byte crypto-secure hex token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: expiresAt,
    },
  });

  // Security audit log
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorRole: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      newValues: {
        email: user.email,
        expiresAt: expiresAt.toISOString(),
      },
    },
  });

  // Dispatch email via mock mailer
  const resetUrl = `http://localhost:5173/reset-password?token=${rawToken}`;
  await mailer.sendEmail({
    to: user.email,
    subject: 'Reset your Brightloop account password',
    text: `Hello ${user.fullName},\n\nYou requested a password reset. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link is valid for 1 hour.\nIf you did not request this, please ignore this email.`,
    html: `<p>Hello <strong>${user.fullName}</strong>,</p><p>You requested a password reset for your Brightloop account. Click the link below to reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in 1 hour.</p>`,
  });

  return genericResponse;
};

export const resetPassword = async (rawToken: string, newPassword: string) => {
  const tokenHash = hashToken(rawToken);

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: { gt: new Date() },
      deletedAt: null,
    },
  });

  if (!user || !user.isActive) {
    throw new BadRequestError('Invalid or expired password reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    // 1. Update user password and clear reset token
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    // 2. Revoke all active refresh tokens for immediate session invalidation
    await tx.refreshToken.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: { isRevoked: true },
    });

    // 3. Security audit log
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: user.role,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: user.id,
        newValues: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  });

  return {
    message: 'Password has been successfully reset. Please log in with your new password.',
  };
};
