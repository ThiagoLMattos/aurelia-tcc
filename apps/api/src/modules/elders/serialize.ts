import type { Elder } from '@aurelia/shared';

import type { ElderDoc } from '../../repos';

/** Firestore doc → wire format (spec §3 → shared ElderSchema). */
export function toElderResponse(doc: ElderDoc): Elder {
  const { locationState: state } = doc;
  return {
    id: doc.id,
    name: doc.name,
    birthDate: doc.birthDate,
    diagnosisStage: doc.diagnosisStage,
    timezone: doc.timezone,
    missedTaskTimeoutMin: doc.missedTaskTimeoutMin,
    safeZone: doc.safeZone,
    locationState: {
      status: state.status,
      since: state.since?.toISOString() ?? null,
      lastLat: state.lastLat,
      lastLng: state.lastLng,
      lastAt: state.lastAt?.toISOString() ?? null,
      consecutiveOutside: state.consecutiveOutside,
      consecutiveInside: state.consecutiveInside,
    },
    phonePaired: doc.phonePairedAt !== null,
    createdAt: doc.createdAt.toISOString(),
  };
}
