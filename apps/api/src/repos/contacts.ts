import type { CreateContactBody, PatchContactBody } from '@aurelia/shared';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { toDate } from './convert';

export interface ContactDoc {
  id: string;
  name: string;
  phone: string;
  relation: string;
  isEmergency: boolean;
  priority: number;
  createdAt: Date;
}

interface ContactData extends Omit<ContactDoc, 'id' | 'createdAt'> {
  createdAt: Timestamp;
}

function fromSnapshot(snap: FirebaseFirestore.DocumentSnapshot): ContactDoc | null {
  if (!snap.exists) return null;
  const data = snap.data() as ContactData;
  return {
    id: snap.id,
    name: data.name,
    phone: data.phone,
    relation: data.relation,
    isEmergency: data.isEmergency,
    priority: data.priority,
    createdAt: toDate(data.createdAt),
  };
}

export type ContactUpdateResult = ContactDoc | 'notFound' | 'emergencyLimit';

export function createContactsRepo(db: Firestore) {
  const col = (elderId: string) => db.collection('elders').doc(elderId).collection('contacts');

  return {
    /** Ordered by priority, then name. The list is small, so it is sorted here instead of indexed. */
    async list(elderId: string): Promise<ContactDoc[]> {
      const snaps = await col(elderId).get();
      return snaps.docs
        .flatMap((snap) => fromSnapshot(snap) ?? [])
        .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, 'pt-BR'));
    },

    /** Returns null when adding it would exceed `emergencyLimit` emergency contacts. */
    async create(elderId: string, body: CreateContactBody, now: Date, emergencyLimit: number): Promise<ContactDoc | null> {
      const ref = col(elderId).doc();
      const created = await db.runTransaction(async (tx) => {
        if (body.isEmergency) {
          const emergency = await tx.get(col(elderId).where('isEmergency', '==', true));
          if (emergency.size >= emergencyLimit) return false;
        }
        tx.create(ref, {
          name: body.name,
          phone: body.phone,
          relation: body.relation,
          isEmergency: body.isEmergency,
          priority: body.priority,
          createdAt: Timestamp.fromDate(now),
        });
        return true;
      });
      return created ? (fromSnapshot(await ref.get()) as ContactDoc) : null;
    },

    async update(elderId: string, contactId: string, patch: PatchContactBody, emergencyLimit: number): Promise<ContactUpdateResult> {
      const ref = col(elderId).doc(contactId);
      const outcome = await db.runTransaction(async (tx) => {
        const current = fromSnapshot(await tx.get(ref));
        if (!current) return 'notFound' as const;
        if (patch.isEmergency === true && !current.isEmergency) {
          const emergency = await tx.get(col(elderId).where('isEmergency', '==', true));
          if (emergency.size >= emergencyLimit) return 'emergencyLimit' as const;
        }
        const fields: Record<string, unknown> = {};
        if (patch.name !== undefined) fields.name = patch.name;
        if (patch.phone !== undefined) fields.phone = patch.phone;
        if (patch.relation !== undefined) fields.relation = patch.relation;
        if (patch.isEmergency !== undefined) fields.isEmergency = patch.isEmergency;
        if (patch.priority !== undefined) fields.priority = patch.priority;
        tx.update(ref, fields);
        return 'ok' as const;
      });
      if (outcome !== 'ok') return outcome;
      return fromSnapshot(await ref.get()) as ContactDoc;
    },

    /** Idempotent. */
    async delete(elderId: string, contactId: string): Promise<void> {
      await col(elderId).doc(contactId).delete();
    },
  };
}

export type ContactsRepo = ReturnType<typeof createContactsRepo>;

