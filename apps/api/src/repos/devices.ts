import type { DeviceLocationBody, DeviceSummary } from '@aurelia/shared';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { isNotFoundError, toDate, toDateOrNull } from './convert';
import { eventData, type EventRecord, type EventsRepo } from './events';

interface DeviceData {
  label: string;
  secretHash: string;
  createdAt: Timestamp;
  lastSeenAt?: Timestamp | null;
  batteryPct?: number | null;
  firmwareVersion?: string | null;
  offlineEventAt?: Timestamp | null;
}

export interface DeviceDoc {
  id: string;
  elderId: string;
  label: string;
  secretHash: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  batteryPct: number | null;
  firmwareVersion: string | null;
  /** When the last `deviceOffline` event was written; compared with `lastSeenAt` to report once. */
  offlineEventAt: Date | null;
}

export type DeviceSummaryDoc = Omit<DeviceSummary, 'lastSeenAt'> & { lastSeenAt: Date | null };

export interface NewDevice {
  label: string;
  secretHash: string;
}

function toDevice(elderId: string, snap: FirebaseFirestore.DocumentSnapshot): DeviceDoc | null {
  if (!snap.exists) return null;
  const data = snap.data() as DeviceData;
  return {
    id: snap.id,
    elderId,
    label: data.label,
    secretHash: data.secretHash,
    createdAt: toDate(data.createdAt),
    lastSeenAt: toDateOrNull(data.lastSeenAt),
    batteryPct: data.batteryPct ?? null,
    firmwareVersion: data.firmwareVersion ?? null,
    offlineEventAt: toDateOrNull(data.offlineEventAt),
  };
}

/**
 * Trackers live under `elders/{id}/devices`. `deviceIndex/{deviceId}` maps a device id back to its
 * elder so a location report (which only knows its own id) is found with one read, not a scan.
 */
export function createDevicesRepo(db: Firestore, events: EventsRepo) {
  const col = (elderId: string) => db.collection('elders').doc(elderId).collection('devices');
  const index = db.collection('deviceIndex');

  async function get(elderId: string, deviceId: string): Promise<DeviceDoc | null> {
    return toDevice(elderId, await col(elderId).doc(deviceId).get());
  }

  return {
    async summaries(elderId: string): Promise<DeviceSummaryDoc[]> {
      const snaps = await col(elderId).get();
      return snaps.docs.map((snap) => {
        const device = toDevice(elderId, snap) as DeviceDoc;
        return { id: device.id, label: device.label, lastSeenAt: device.lastSeenAt, batteryPct: device.batteryPct };
      });
    },

    async list(elderId: string): Promise<DeviceDoc[]> {
      const snaps = await col(elderId).get();
      return snaps.docs.flatMap((snap) => toDevice(elderId, snap) ?? []);
    },

    get,

    /** Resolves a device from its id alone, through the index. */
    async find(deviceId: string): Promise<DeviceDoc | null> {
      const entry = await index.doc(deviceId).get();
      const elderId = (entry.data() as { elderId?: string } | undefined)?.elderId;
      return elderId ? get(elderId, deviceId) : null;
    },

    /** Device, index entry and `devicePaired` event are written together. */
    async create(elderId: string, device: NewDevice, now: Date, paired: (deviceId: string) => EventRecord): Promise<string> {
      const ref = col(elderId).doc();
      const batch = db.batch();
      batch.create(ref, {
        label: device.label,
        secretHash: device.secretHash,
        createdAt: Timestamp.fromDate(now),
        lastSeenAt: null,
        batteryPct: null,
        firmwareVersion: null,
        offlineEventAt: null,
      });
      batch.create(index.doc(ref.id), { elderId });
      batch.create(events.newRef(elderId), eventData(paired(ref.id)));
      await batch.commit();
      return ref.id;
    },

    /** Returns false when the device does not exist. */
    async remove(elderId: string, deviceId: string): Promise<boolean> {
      const ref = col(elderId).doc(deviceId);
      if (!(await ref.get()).exists) return false;
      const batch = db.batch();
      batch.delete(ref);
      batch.delete(index.doc(deviceId));
      await batch.commit();
      return true;
    },

    /** Records that the tracker reported in. */
    async touch(elderId: string, deviceId: string, at: Date, report: DeviceLocationBody): Promise<void> {
      const fields: Record<string, unknown> = { lastSeenAt: Timestamp.fromDate(at) };
      if (report.batteryPct !== undefined) fields.batteryPct = report.batteryPct;
      if (report.fwVersion !== undefined) fields.firmwareVersion = report.fwVersion;
      try {
        await col(elderId).doc(deviceId).update(fields);
      } catch (error) {
        // Removed while its report was being processed.
        if (!isNotFoundError(error)) throw error;
      }
    },

    /**
     * Writes a `deviceOffline` event if the tracker has been silent since before `cutoff` and no such
     * event was written for this silence yet. Returns the event id, or null when there is nothing to do.
     */
    async markOffline(
      elderId: string,
      deviceId: string,
      cutoff: Date,
      at: Date,
      record: (lastSeenAt: Date | null) => EventRecord,
    ): Promise<string | null> {
      const ref = col(elderId).doc(deviceId);
      const eventRef = events.newRef(elderId);
      return db.runTransaction(async (tx) => {
        const device = toDevice(elderId, await tx.get(ref));
        if (!device) return null;
        // A tracker that never reported counts from the day it was registered.
        const silentSince = device.lastSeenAt ?? device.createdAt;
        if (silentSince >= cutoff) return null;
        if (device.offlineEventAt && device.offlineEventAt > silentSince) return null;

        tx.create(eventRef, eventData(record(device.lastSeenAt)));
        tx.update(ref, { offlineEventAt: Timestamp.fromDate(at) });
        return eventRef.id;
      });
    },
  };
}

export type DevicesRepo = ReturnType<typeof createDevicesRepo>;
