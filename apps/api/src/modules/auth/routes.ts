import { SignupBodySchema, type SignupBody } from '@aurelia/shared';
import { Router } from 'express';

import { createRateLimiter } from '../../http/rateLimit';
import { validate } from '../../http/validate';
import type { AuthService } from './service';

interface Deps {
  service: AuthService;
  signupPerHour: number;
}

export function authRoutes({ service, signupPerHour }: Deps): Router {
  const router = Router();
  const signupLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: signupPerHour,
    message: 'Muitos cadastros deste endereço. Tente novamente em uma hora.',
  });

  router.post('/signup', signupLimiter, validate({ body: SignupBodySchema }), async (req, res) => {
    res.status(201).json(await service.signup(req.body as SignupBody));
  });

  return router;
}
