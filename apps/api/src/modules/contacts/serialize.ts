import type { Contact } from '@aurelia/shared';

import type { ContactDoc } from '../../repos';

export const toContact = (doc: ContactDoc): Contact => ({ ...doc, createdAt: doc.createdAt.toISOString() });
