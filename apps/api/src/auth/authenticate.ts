import type { Auth } from 'firebase-admin/auth';
import type { RequestHandler } from 'express';

import { forbidden, unauthenticated } from '../http/errors';

/**
 * Verifies the Bearer ID token (revocation checked) and builds req.auth. Role and elderId come
 * only from custom claims; a token without a valid role is rejected, never defaulted.
 */
export function authenticate(auth: Auth): RequestHandler {
  return async (req, _res, next) => {
    try {
      const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
      if (!match?.[1]) throw unauthenticated();

      let claims;
      try {
        claims = await auth.verifyIdToken(match[1], true);
      } catch {
        throw unauthenticated('Sessão inválida ou expirada. Faça login novamente.');
      }

      if (claims.role === 'caregiver') {
        req.auth = { uid: claims.uid, role: 'caregiver' };
      } else if (claims.role === 'elder' && typeof claims.elderId === 'string' && claims.elderId) {
        req.auth = { uid: claims.uid, role: 'elder', elderId: claims.elderId };
      } else {
        throw forbidden('Conta sem permissão de acesso.');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
