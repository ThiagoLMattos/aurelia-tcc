import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

import { rateLimited } from './errors';

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message?: string;
  /** Defaults to the client IP. */
  key?: (req: Parameters<RequestHandler>[0]) => string;
}

/** Fixed-window limiter that reports through the shared error shape (429 RATE_LIMITED). */
export function createRateLimiter({ windowMs, limit, message, key }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(key ? { keyGenerator: key } : {}),
    handler: (_req, _res, next) => next(rateLimited(message)),
  });
}
