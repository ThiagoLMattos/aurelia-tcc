import { INITIAL_LOCATION_STATE, type DiagnosisStage, type LocationStatus, type SafeZone } from '@aurelia/shared';
import { FieldValue, type Firestore, type Timestamp } from 'firebase-admin/firestore';

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
}

interface ElderData extends Omit<ElderDoc, 'id' | 'createdAt' | 'locationState'> {
  createdAt: Timestamp;
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

    addPushToken: (id: string, token: string) => updateIfExists(id, { pushTokens: FieldValue.arrayUnion(token) }),
    removePushToken: (id: string, token: string) => updateIfExists(id, { pushTokens: FieldValue.arrayRemove(token) }),
  };
}

export type EldersRepo = ReturnType<typeof createEldersRepo>;
