import {
  INITIAL_LOCATION_STATE,
  type CreateElderBody,
  type DiagnosisStage,
  type LocationStatus,
  type PatchElderBody,
  type SafeZone,
} from '@aurelia/shared';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

import { isNotFoundError, toDate, toDateOrNull } from './convert';

export interface ElderLocationState {
  status: LocationStatus;
  since: Date | null;
  lastLat: number | null;
  lastLng: number | null;
  lastAt: Date | null;
  consecutiveOutside: number;
  consecutiveInside: number;
}

export interface ElderDoc {
  id: string;
  name: string;
  birthDate: string;
  diagnosisStage: DiagnosisStage;
  timezone: string;
  createdAt: Date;
  createdBy: string;
  missedTaskTimeoutMin: 15 | 30 | 60;
  caregiverIds: string[];
  safeZone: SafeZone | null;
  locationState: ElderLocationState;
  pushTokens: string[];
  /** When the elder phone last paired; null while unpaired. */
  phonePairedAt: Date | null;
}

interface ElderData extends Omit<ElderDoc, 'id' | 'createdAt' | 'locationState' | 'phonePairedAt'> {
  createdAt: Timestamp;
  phonePairedAt?: Timestamp | null;
  locationState?: Partial<Omit<ElderLocationState, 'since' | 'lastAt'>> & {
    since?: Timestamp | null;
    lastAt?: Timestamp | null;
  };
}

function fromSnapshot(snap: FirebaseFirestore.DocumentSnapshot): ElderDoc | null {
  if (!snap.exists) return null;
  const data = snap.data() as ElderData;
  const state = data.locationState ?? {};
  return {
    id: snap.id,
    name: data.name,
    birthDate: data.birthDate,
    diagnosisStage: data.diagnosisStage,
    timezone: data.timezone,
    createdAt: toDate(data.createdAt),
    createdBy: data.createdBy,
    missedTaskTimeoutMin: data.missedTaskTimeoutMin,
    caregiverIds: data.caregiverIds ?? [],
    safeZone: data.safeZone ?? null,
    locationState: {
      status: state.status ?? INITIAL_LOCATION_STATE.status,
      since: toDateOrNull(state.since),
      lastLat: state.lastLat ?? null,
      lastLng: state.lastLng ?? null,
      lastAt: toDateOrNull(state.lastAt),
      consecutiveOutside: state.consecutiveOutside ?? 0,
      consecutiveInside: state.consecutiveInside ?? 0,
    },
    pushTokens: data.pushTokens ?? [],
    phonePairedAt: toDateOrNull(data.phonePairedAt),
  };
}

export function createEldersRepo(db: Firestore) {
  const col = db.collection('elders');

  async function updateIfExists(id: string, fields: Record<string, unknown>): Promise<boolean> {
    try {
      await col.doc(id).update(fields);
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  return {
    async get(id: string): Promise<ElderDoc | null> {
      return fromSnapshot(await col.doc(id).get());
    },

    /** Missing elders are skipped; order follows `ids`. */
    async getMany(ids: string[]): Promise<ElderDoc[]> {
      if (ids.length === 0) return [];
      const snaps = await db.getAll(...ids.map((id) => col.doc(id)));
      return snaps.flatMap((snap) => fromSnapshot(snap) ?? []);
    },

    /** Every elder, for jobs that sweep all of them. */
    async listAll(): Promise<ElderDoc[]> {
      const snaps = await col.get();
      return snaps.docs.flatMap((snap) => fromSnapshot(snap) ?? []);
    },

    /**
     * Creates the elder and adds its id to the creator's `elderIds` in one batch.
     * Returns null when the creator has no profile document.
     */
    async create(creatorId: string, body: CreateElderBody, now: Date): Promise<ElderDoc | null> {
      const ref = col.doc();
      const batch = db.batch();
      batch.create(ref, {
        name: body.name,
        birthDate: body.birthDate,
        diagnosisStage: body.diagnosisStage,
        timezone: body.timezone,
        createdAt: Timestamp.fromDate(now),
        createdBy: creatorId,
        missedTaskTimeoutMin: body.missedTaskTimeoutMin,
        caregiverIds: [creatorId],
        safeZone: body.safeZone,
        locationState: INITIAL_LOCATION_STATE,
        pushTokens: [],
        phonePairedAt: null,
      });
      batch.update(db.collection('users').doc(creatorId), { elderIds: FieldValue.arrayUnion(ref.id) });
      try {
        await batch.commit();
      } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
      return fromSnapshot(await ref.get());
    },

    /** Applies only the fields present in the patch. Returns false if the elder does not exist. */
    update(id: string, patch: PatchElderBody): Promise<boolean> {
      const fields: Record<string, unknown> = {};
      if (patch.name !== undefined) fields.name = patch.name;
      if (patch.birthDate !== undefined) fields.birthDate = patch.birthDate;
      if (patch.diagnosisStage !== undefined) fields.diagnosisStage = patch.diagnosisStage;
      if (patch.timezone !== undefined) fields.timezone = patch.timezone;
      if (patch.missedTaskTimeoutMin !== undefined) fields.missedTaskTimeoutMin = patch.missedTaskTimeoutMin;
      if (patch.safeZone !== undefined) fields.safeZone = patch.safeZone;
      return updateIfExists(id, fields);
    },

    /** A new phone replaces the previous one, so the old push tokens go too. */
    markPaired: (id: string, now: Date) =>
      updateIfExists(id, { phonePairedAt: Timestamp.fromDate(now), pushTokens: [] }),

    /** Unpairs the elder phone: forgets its push tokens and the pairing time. */
    clearPhone: (id: string) => updateIfExists(id, { pushTokens: [], phonePairedAt: null }),

    addPushToken: (id: string, token: string) => updateIfExists(id, { pushTokens: FieldValue.arrayUnion(token) }),
    removePushToken: (id: string, token: string) => updateIfExists(id, { pushTokens: FieldValue.arrayRemove(token) }),
  };
}

export type EldersRepo = ReturnType<typeof createEldersRepo>;
