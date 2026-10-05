import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { isAlreadyExistsError, toDate } from './convert';

interface PairingCodeData {
  elderId: string;
  kind: 'elderPhone';
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  usedAt: Timestamp | null;
  attempts: number;
}

export function createPairingCodesRepo(db: Firestore) {
  const col = db.collection('pairingCodes');

  return {
    /**
     * Stores `code` for the elder and deletes the elder's earlier unused codes in the same batch.
     * Returns false when the code is already taken (the caller picks another).
     */
    async issue(elderId: string, code: string, createdBy: string, now: Date, expiresAt: Date): Promise<boolean> {
      const previous = await col.where('elderId', '==', elderId).get();
      const batch = db.batch();
      for (const snap of previous.docs) {
        if ((snap.data() as PairingCodeData).usedAt === null) batch.delete(snap.ref);
      }
      batch.create(col.doc(code), {
        elderId,
        kind: 'elderPhone',
        createdBy,
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt),
        usedAt: null,
        attempts: 0,
      } satisfies PairingCodeData);
      try {
        await batch.commit();
        return true;
      } catch (error) {
        if (isAlreadyExistsError(error)) return false;
        throw error;
      }
    },

    /**
     * Marks the code used, atomically. Returns the elder id, or null when the code does not
     * exist, is expired or was already used (callers must not tell these apart).
     */
    redeem(code: string, now: Date): Promise<string | null> {
      const ref = col.doc(code);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const data = snap.data() as PairingCodeData;
        if (data.usedAt !== null || toDate(data.expiresAt).getTime() <= now.getTime()) return null;
        tx.update(ref, { usedAt: Timestamp.fromDate(now), attempts: data.attempts + 1 });
        return data.elderId;
      });
    },

    /** Undoes a redeem when the sign-in setup after it failed, so the elder can retry with the same code. */
    async release(code: string): Promise<void> {
      await col.doc(code).update({ usedAt: null });
    },
  };
}

export type PairingCodesRepo = ReturnType<typeof createPairingCodesRepo>;
