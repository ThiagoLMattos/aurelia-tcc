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
  /** "Sobre ela", written by the caregivers for Aurélia. */
  about: string;
}

interface ElderData extends Omit<ElderDoc, 'id' | 'createdAt' | 'locationState' | 'phonePairedAt' | 'about'> {
  createdAt: Timestamp;
  about?: string;
  phonePairedAt?: Timestamp | null;
  locationState?: Partial<Omit<ElderLocationState, 'since' | 'lastAt'>> & {
    since?: Timestamp | null;
    lastAt?: Timestamp | null;
  };
}

export function elderFromSnapshot(snap: FirebaseFirestore.DocumentSnapshot): ElderDoc | null {
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
    about: data.about ?? '',
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
      return elderFromSnapshot(await col.doc(id).get());
    },

    /** Missing elders are skipped; order follows `ids`. */
    async getMany(ids: string[]): Promise<ElderDoc[]> {
      if (ids.length === 0) return [];
      const snaps = await db.getAll(...ids.map((id) => col.doc(id)));
      return snaps.flatMap((snap) => elderFromSnapshot(snap) ?? []);
    },

    /** Every elder, for jobs that sweep all of them. */
    async listAll(): Promise<ElderDoc[]> {
      const snaps = await col.get();
      return snaps.docs.flatMap((snap) => elderFromSnapshot(snap) ?? []);
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
        about: '',
      });
      batch.update(db.collection('users').doc(creatorId), { elderIds: FieldValue.arrayUnion(ref.id) });
      try {
        await batch.commit();
      } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
      return elderFromSnapshot(await ref.get());
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
      if (patch.about !== undefined) fields.about = patch.about;
      return updateIfExists(id, fields);
    },

    /**
     * Adds a caregiver to the elder and the elder to the caregiver's `elderIds`, atomically. Joining
     * an elder already followed changes nothing. Returns false when the elder or the caregiver is missing.
     */
    addCaregiver(elderId: string, caregiverId: string): Promise<boolean> {
      const elderRef = col.doc(elderId);
      const userRef = db.collection('users').doc(caregiverId);
      return db.runTransaction(async (tx) => {
        const [elder, user] = await Promise.all([tx.get(elderRef), tx.get(userRef)]);
        if (!elder.exists || !user.exists) return false;
        tx.update(elderRef, { caregiverIds: FieldValue.arrayUnion(caregiverId) });
        tx.update(userRef, { elderIds: FieldValue.arrayUnion(elderId) });
        return true;
      });
    },

    /**
     * Takes a caregiver off the elder, atomically, unless they are its last one (an elder always has
     * someone; the last caregiver deletes their account instead).
     */
    removeCaregiver(elderId: string, caregiverId: string): Promise<'removed' | 'notFound' | 'last'> {
      const elderRef = col.doc(elderId);
      const userRef = db.collection('users').doc(caregiverId);
      return db.runTransaction(async (tx) => {
        const elder = await tx.get(elderRef);
        const ids = (elder.data()?.caregiverIds as string[] | undefined) ?? [];
        if (!elder.exists || !ids.includes(caregiverId)) return 'notFound';
        if (ids.length === 1) return 'last';
        const user = await tx.get(userRef);
        tx.update(elderRef, { caregiverIds: FieldValue.arrayRemove(caregiverId) });
        if (user.exists) tx.update(userRef, { elderIds: FieldValue.arrayRemove(elderId) });
        return 'removed';
      });
    },

    /**
     * Reserves the elder's daily summary for `date`, atomically, so two job runs never write it twice.
     * Returns false when that date's summary was already claimed.
     */
    claimDailySummary(elderId: string, date: string): Promise<boolean> {
      const ref = col.doc(elderId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists || snap.data()?.dailySummaryDate === date) return false;
        tx.update(ref, { dailySummaryDate: date });
        return true;
      });
    },

    /** Gives a claim back after the summary failed, so the next run tries again. */
    releaseDailySummary: (elderId: string) => updateIfExists(elderId, { dailySummaryDate: null }),

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
