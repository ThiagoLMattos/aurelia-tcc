import {
  ContactParamsSchema,
  CreateContactBodySchema,
  PatchContactBodySchema,
  type ContactParams,
  type CreateContactBody,
  type PatchContactBody,
} from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { validate } from '../../http/validate';
import type { ContactsService } from './service';

/** Mounted at /elders/:elderId/contacts. Caregivers and the elder may both manage contacts (spec §5). */
export function contactsRoutes(service: ContactsService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (_req, res) => {
    res.json(await service.list(loadedElder(res).id));
  });

  router.post('/', validate({ body: CreateContactBodySchema }), async (req, res) => {
    res.status(201).json(await service.create(loadedElder(res).id, req.body as CreateContactBody));
  });

  router.patch('/:contactId', validate({ params: ContactParamsSchema, body: PatchContactBodySchema }), async (req, res) => {
    res.json(await service.patch(loadedElder(res).id, (req.params as unknown as ContactParams).contactId, req.body as PatchContactBody));
  });

  router.delete('/:contactId', validate({ params: ContactParamsSchema }), async (req, res) => {
    await service.remove(loadedElder(res).id, (req.params as unknown as ContactParams).contactId);
    res.status(204).end();
  });

  return router;
}
