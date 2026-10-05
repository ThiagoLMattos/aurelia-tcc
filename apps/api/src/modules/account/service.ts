import type { Logger } from 'pino';

import type { Firebase } from '../../firebase';
import { elderUid } from '../pairing/service';

interface Deps {
  firebase: Firebase;
  logger: Logger;
}

const isAuthUserMissing = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'auth/user-not-found';

export function createAccountService({ firebase: { db, auth }, logger }: Deps) {
  /** The elder and everything under it: timeline, routines, contacts, trackers, pairing codes and its phone's login. */
  async function deleteElder(elderId: string): Promise<void> {
    const ref = db.collection('elders').doc(elderId);
    for (const device of (await ref.collection('devices').get()).docs) await db.collection('deviceIndex').doc(device.id).delete();
    for (const code of (await db.collection('pairingCodes').where('elderId', '==', elderId).get()).docs) await code.ref.delete();
    await auth.deleteUser(elderUid(elderId)).catch((error: unknown) => {
      if (!isAuthUserMissing(error)) throw error;
    });
    await db.recursiveDelete(ref);
  }

  return {
    /**
     * DELETE /me: the caregiver's profile and login, and every elder no other caregiver follows (with
     * all of its data). An elder shared with someone else stays with them; only this caregiver leaves it.
     * Returns how many elders were deleted. Safe to run again after a partial failure.
     */
    async deleteCaregiver(uid: string): Promise<{ eldersDeleted: number }> {
      const user = await db.collection('users').doc(uid).get();
      const elderIds: string[] = user.exists ? ((user.data()?.elderIds as string[] | undefined) ?? []) : [];

      let eldersDeleted = 0;
      for (const elderId of elderIds) {
        const ref = db.collection('elders').doc(elderId);
        const othersLeft = await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return null;
          const others = ((snap.data()?.caregiverIds as string[] | undefined) ?? []).filter((id) => id !== uid);
          if (others.length > 0) tx.update(ref, { caregiverIds: others });
          return others.length;
        });
        if (othersLeft !== 0) continue;
        await deleteElder(elderId);
        eldersDeleted += 1;
      }

      await db.collection('users').doc(uid).delete();
      await auth.deleteUser(uid).catch((error: unknown) => {
        if (!isAuthUserMissing(error)) throw error;
      });
      logger.info({ uid, eldersDeleted }, 'caregiver account deleted');
      return { eldersDeleted };
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
