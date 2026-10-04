import type { Contact } from '@/data/mock';
import { http } from '@/services/http';
import type { ContactService } from '@/services/types';

/**
 * Expected backend endpoints:
 *   GET    /contacts         → Contact[]
 *   POST   /contacts         → Contact (with server-assigned id)
 *   PATCH  /contacts/:id     → void
 *   DELETE /contacts/:id     → void
 */
export const contactService: ContactService = {
  getContacts: ()           => http.get<Contact[]>('/contacts'),
  add:         (contact)    => http.post<Contact>('/contacts', contact),
  update:      (id, patch)  => http.patch<void>(`/contacts/${id}`, patch),
  remove:      (id)         => http.delete(`/contacts/${id}`),
};
