import type { CreateRoutineBody, LocalTime, Medication, PatchRoutineBody, RoutineType, Weekday } from '@aurelia/shared';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { isNotFoundError, toDate } from './convert';

export interface RoutineDoc {
  id: string;
  type: RoutineType;
  name: string;
  description: string;
  time: LocalTime;
  weekdays: Weekday[];
  medication: Medication | null;
  remindElder: boolean;
  alertIfMissed: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface RoutineData extends Omit<RoutineDoc, 'id' | 'createdAt' | 'updatedAt'> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function fromSnapshot(snap: FirebaseFirestore.DocumentSnapshot): RoutineDoc | null {
  if (!snap.exists) return null;
  const data = snap.data() as RoutineData;
  return {
    id: snap.id,
    type: data.type,
    name: data.name,
    description: data.description,
    time: data.time,
    weekdays: data.weekdays,
    medication: data.medication ?? null,
    remindElder: data.remindElder,
    alertIfMissed: data.alertIfMissed,
    active: data.active,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function createRoutinesRepo(db: Firestore) {
  const col = (elderId: string) => db.collection('elders').doc(elderId).collection('routines');

  return {
    /** All routines, inactive ones included (history and reports still need their names/types). */
    async list(elderId: string): Promise<RoutineDoc[]> {
      const snaps = await col(elderId).get();
      return snaps.docs.flatMap((snap) => fromSnapshot(snap) ?? []);
    },

    async get(elderId: string, routineId: string): Promise<RoutineDoc | null> {
      return fromSnapshot(await col(elderId).doc(routineId).get());
    },

    async create(elderId: string, body: CreateRoutineBody, now: Date): Promise<RoutineDoc> {
      const ref = col(elderId).doc();
      const at = Timestamp.fromDate(now);
      await ref.create({
        type: body.type,
        name: body.name,
        description: body.description,
        time: body.time,
        weekdays: body.weekdays,
        medication: body.medication ?? null,
        remindElder: body.remindElder,
        alertIfMissed: body.alertIfMissed,
        active: body.active,
        createdAt: at,
        updatedAt: at,
      });
      return fromSnapshot(await ref.get()) as RoutineDoc;
    },

    /**
     * Applies only the fields of the patch. A routine that stops being a medication loses its
     * medication data. Returns null if the routine does not exist.
     */
    async update(elderId: string, routineId: string, patch: PatchRoutineBody, now: Date): Promise<RoutineDoc | null> {
      const fields: Record<string, unknown> = { updatedAt: Timestamp.fromDate(now) };
      if (patch.type !== undefined) fields.type = patch.type;
      if (patch.name !== undefined) fields.name = patch.name;
      if (patch.description !== undefined) fields.description = patch.description;
      if (patch.time !== undefined) fields.time = patch.time;
      if (patch.weekdays !== undefined) fields.weekdays = patch.weekdays;
      if (patch.remindElder !== undefined) fields.remindElder = patch.remindElder;
      if (patch.alertIfMissed !== undefined) fields.alertIfMissed = patch.alertIfMissed;
      if (patch.active !== undefined) fields.active = patch.active;
      if (patch.medication !== undefined) fields.medication = patch.medication;
      else if (patch.type !== undefined && patch.type !== 'medication') fields.medication = null;

      const ref = col(elderId).doc(routineId);
      try {
        await ref.update(fields);
      } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
      return fromSnapshot(await ref.get());
    },

    /** Soft delete: history keeps the routine's name. Idempotent. Returns false if it does not exist. */
    async deactivate(elderId: string, routineId: string, now: Date): Promise<boolean> {
      try {
        await col(elderId).doc(routineId).update({ active: false, updatedAt: Timestamp.fromDate(now) });
        return true;
      } catch (error) {
        if (isNotFoundError(error)) return false;
        throw error;
      }
    },
  };
}

export type RoutinesRepo = ReturnType<typeof createRoutinesRepo>;

