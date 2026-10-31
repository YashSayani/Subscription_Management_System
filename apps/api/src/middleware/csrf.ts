import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../common/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtection = (req: Request, _res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // State-changing requests must carry a custom client-side header
  // Browsers block third-party cross-origin scripts from forging custom headers unless allowed by CORS preflight.
  const requestedWith = req.header('x-requested-with');
  const csrfToken = req.header('x-csrf-token');

  if (!requestedWith && !csrfToken) {
    next(
      new ForbiddenError(
        'CSRF protection: state-changing requests must include a valid custom header (e.g. X-Requested-With: XMLHttpRequest)',
      ),
    );
    return;
  }

  next();
};
