import type { RequestHandler } from 'express';

import { forbidden, notFound, unauthenticated } from '../http/errors';
import type { ElderDoc } from '../repos';

interface ElderReader {
  get(id: string): Promise<ElderDoc | null>;
}

/**
 * Spec §5 access rule for /elders/:elderId/**: caregivers must be listed in the elder's
 * caregiverIds; an elder token must carry the same elderId. Loads the elder once into
 * res.locals.elder.
 */
export function requireElderAccess(elders: ElderReader): RequestHandler<{ elderId: string }> {
  return async (req, res, next) => {
    try {
      const { auth } = req;
      if (!auth) throw unauthenticated();
      const { elderId } = req.params;

      if (auth.role === 'elder' && auth.elderId !== elderId) throw forbidden();

      const elder = await elders.get(elderId);
      if (!elder) throw notFound('Idoso não encontrado.');
      if (auth.role === 'caregiver' && !elder.caregiverIds.includes(auth.uid)) throw forbidden();

      res.locals.elder = elder;
      next();
    } catch (error) {
      next(error);
    }
  };
}
