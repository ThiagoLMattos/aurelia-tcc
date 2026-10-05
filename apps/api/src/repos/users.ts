import { DEFAULT_CAREGIVER_SETTINGS, type CaregiverSettings, type PatchMeBody } from '@aurelia/shared';
import { FieldValue, type Firestore, type Timestamp } from 'firebase-admin/firestore';

import { isNotFoundError, toDate } from './convert';

export interface UserDoc {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  settings: CaregiverSettings;
  pushTokens: string[];
  elderIds: string[];
}

export interface NewUser {
  id: string;
  name: string;
  email: string;
}

export type UserPatch = PatchMeBody;

interface UserData {
  name: string;
  email: string;
  createdAt: Timestamp;
  settings?: Partial<CaregiverSettings>;
  pushTokens?: string[];
  elderIds?: string[];
}

function fromSnapshot(snap: FirebaseFirestore.DocumentSnapshot): UserDoc | null {
  if (!snap.exists) return null;
  const data = snap.data() as UserData;
  return {
    id: snap.id,
    name: data.name,
    email: data.email,
    createdAt: toDate(data.createdAt),
    settings: { ...DEFAULT_CAREGIVER_SETTINGS, ...data.settings },
    pushTokens: data.pushTokens ?? [],
    elderIds: data.elderIds ?? [],
  };
}

export function createUsersRepo(db: Firestore) {
  const col = db.collection('users');

  return {
    /** Fails if the document already exists. New users get the default settings. */
    async create(user: NewUser): Promise<void> {
      await col.doc(user.id).create({
        name: user.name,
        email: user.email,
        createdAt: FieldValue.serverTimestamp(),
        settings: DEFAULT_CAREGIVER_SETTINGS,
        pushTokens: [],
        elderIds: [],
      });
    },

    async get(id: string): Promise<UserDoc | null> {
      return fromSnapshot(await col.doc(id).get());
    },

    /** Missing users are skipped. */
    async getMany(ids: string[]): Promise<UserDoc[]> {
      if (ids.length === 0) return [];
      const snaps = await db.getAll(...ids.map((id) => col.doc(id)));
      return snaps.flatMap((snap) => fromSnapshot(snap) ?? []);
    },

    /** Returns false when the user does not exist. */
    async update(id: string, patch: UserPatch): Promise<boolean> {
      const fields: Record<string, unknown> = {};
      if (patch.name !== undefined) fields.name = patch.name;
      for (const [key, value] of Object.entries(patch.settings ?? {})) {
        if (value !== undefined) fields[`settings.${key}`] = value;
      }
      if (Object.keys(fields).length === 0) return (await col.doc(id).get()).exists;
      return updateIfExists(col.doc(id), fields);
    },

    addPushToken: (id: string, token: string) =>
      updateIfExists(col.doc(id), { pushTokens: FieldValue.arrayUnion(token) }),

    removePushToken: (id: string, token: string) =>
      updateIfExists(col.doc(id), { pushTokens: FieldValue.arrayRemove(token) }),
  };
}

export type UsersRepo = ReturnType<typeof createUsersRepo>;

async function updateIfExists(ref: FirebaseFirestore.DocumentReference, fields: Record<string, unknown>) {
  try {
    await ref.update(fields);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}
