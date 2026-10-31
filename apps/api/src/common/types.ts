/* eslint-disable @typescript-eslint/no-namespace */
import { UserRole } from '@brightloop/shared';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
