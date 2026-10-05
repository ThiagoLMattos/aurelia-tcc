import type { DeviceSummary } from '@aurelia/shared';
import type { Firestore, Timestamp } from 'firebase-admin/firestore';

import { toDateOrNull } from './convert';

interface DeviceData {
  label: string;
  lastSeenAt?: Timestamp | null;
  batteryPct?: number | null;
}

export interface DeviceSummaryDoc extends Omit<DeviceSummary, 'lastSeenAt'> {
  lastSeenAt: Date | null;
}

/** Read side only for now; registering and updating trackers arrives with the device endpoints. */
export function createDevicesRepo(db: Firestore) {
  return {
    async summaries(elderId: string): Promise<DeviceSummaryDoc[]> {
      const snaps = await db.collection('elders').doc(elderId).collection('devices').get();
      return snaps.docs.map((snap) => {
        const data = snap.data() as DeviceData;
        return {
          id: snap.id,
          label: data.label,
          lastSeenAt: toDateOrNull(data.lastSeenAt),
          batteryPct: data.batteryPct ?? null,
        };
      });
    },
  };
}

export type DevicesRepo = ReturnType<typeof createDevicesRepo>;
