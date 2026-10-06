import {
  AssistantMemoryParamsSchema,
  AssistantMessageBodySchema,
  type AssistantMemoryParams,
  type AssistantMessageBody,
} from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { createRateLimiter } from '../../http/rateLimit';
import { validate } from '../../http/validate';
import type { AssistantService } from './service';

/** Mounted at /elders/:elderId/assistant. The limit is per elder, shared by its caregivers and its phone. */
export function assistantRoutes(service: AssistantService, perHour: number): Router {
  const router = Router({ mergeParams: true });
  const limiter = createRateLimiter({
    windowMs: 60 * 60_000,
    limit: perHour,
    message: 'Muitas mensagens para o assistente. Tente novamente mais tarde.',
    key: (req) => String(req.params?.elderId),
  });

  router.post('/messages', validate({ body: AssistantMessageBodySchema }), limiter, async (req, res) => {
    res.json(await service.reply(loadedElder(res), req.auth!.role, req.body as AssistantMessageBody));
  });

  /** What Aurélia remembers from the elder's conversations, so the family can see and remove it. */
  router.get('/memories', requireRole('caregiver'), async (_req, res) => {
    res.json(await service.listMemories(loadedElder(res)));
  });

  router.delete('/memories/:memoryId', requireRole('caregiver'), validate({ params: AssistantMemoryParamsSchema }), async (req, res) => {
    await service.forget(loadedElder(res), (req.params as unknown as AssistantMemoryParams).memoryId);
    res.status(204).end();
  });

  return router;
}
