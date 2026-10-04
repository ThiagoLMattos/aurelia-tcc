import type { RequestHandler } from 'express';

import { forbidden, unauthenticated } from '../http/errors';

export function requireRole(role: Express.AuthContext['role']): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthenticated());
    if (req.auth.role !== role) return next(forbidden());
    next();
  };
}
