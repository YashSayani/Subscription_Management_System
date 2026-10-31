import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@brightloop/shared';
import { ForbiddenError, UnauthorizedError } from '../common/errors.js';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Access forbidden: requires one of roles [${allowedRoles.join(', ')}]`,
        ),
      );
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireStaffOrAdmin = requireRole(UserRole.ADMIN, UserRole.STAFF);

// Permissions map
export const PERMISSIONS = {
  CREATE_STAFF: [UserRole.ADMIN],
  MANAGE_USERS: [UserRole.ADMIN],
  MANAGE_CATALOG: [UserRole.ADMIN],
  VIEW_CATALOG: [UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER],
  CREATE_QUOTATION: [UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER],
  CONFIRM_QUOTATION: [UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER],
  MANAGE_SUBSCRIPTION: [UserRole.ADMIN, UserRole.STAFF],
  VIEW_SUBSCRIPTION: [UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER],
  VOID_INVOICE: [UserRole.ADMIN],
  VIEW_INVOICE: [UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER],
  RECORD_PAYMENT: [UserRole.ADMIN, UserRole.STAFF],
  VIEW_PAYMENT: [UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER],
  MANAGE_DISCOUNTS: [UserRole.ADMIN],
  APPLY_DISCOUNT: [UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER],
  VIEW_ANALYTICS: [UserRole.ADMIN, UserRole.STAFF],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const requirePermission = (permission: Permission) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const allowedRoles = PERMISSIONS[permission] as readonly UserRole[];
    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Access forbidden: permission ${permission} requires role in [${allowedRoles.join(', ')}]`,
        ),
      );
      return;
    }

    next();
  };
};
