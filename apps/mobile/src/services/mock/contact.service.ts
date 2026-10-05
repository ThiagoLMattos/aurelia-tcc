import { MOCK_CONTACTS } from '@/data/mock';
import type { ContactService } from '@/services/types';

export const contactService: ContactService = {
  getContacts: async () => MOCK_CONTACTS,

  add: async (contact) => ({
    ...contact,
    id: `contact-${Date.now()}`,
  }),

  // No-ops — state is managed optimistically in AppContext.
  update: async () => {},
  remove: async () => {},
};
