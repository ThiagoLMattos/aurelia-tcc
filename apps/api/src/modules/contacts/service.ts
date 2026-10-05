import {
  MAX_EMERGENCY_CONTACTS,
  type Contact,
  type ContactsResponse,
  type CreateContactBody,
  type PatchContactBody,
} from '@aurelia/shared';

import type { Clock } from '../../clock';
import { conflict, notFound } from '../../http/errors';
import type { ContactsRepo } from '../../repos/contacts';
import { toContact } from './serialize';

interface Deps {
  contacts: ContactsRepo;
  now: Clock;
}

const EMERGENCY_LIMIT_MESSAGE = `Limite de ${MAX_EMERGENCY_CONTACTS} contatos de emergência atingido.`;

export function createContactsService({ contacts, now }: Deps) {
  return {
    async list(elderId: string): Promise<ContactsResponse> {
      return { items: (await contacts.list(elderId)).map(toContact) };
    },

    async create(elderId: string, body: CreateContactBody): Promise<Contact> {
      const created = await contacts.create(elderId, body, now(), MAX_EMERGENCY_CONTACTS);
      if (!created) throw conflict(EMERGENCY_LIMIT_MESSAGE);
      return toContact(created);
    },

    async patch(elderId: string, contactId: string, patch: PatchContactBody): Promise<Contact> {
      const result = await contacts.update(elderId, contactId, patch, MAX_EMERGENCY_CONTACTS);
      if (result === 'notFound') throw notFound('Contato não encontrado.');
      if (result === 'emergencyLimit') throw conflict(EMERGENCY_LIMIT_MESSAGE);
      return toContact(result);
    },

    async remove(elderId: string, contactId: string): Promise<void> {
      await contacts.delete(elderId, contactId);
    },
  };
}

export type ContactsService = ReturnType<typeof createContactsService>;
