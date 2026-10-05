import type { GamePlayedPayload } from '@aurelia/shared';

import { api } from '@/lib/backend';

import { createResultSender } from './results';

const sender = createResultSender({ send: (elderId, result) => api.sendGameResult(elderId, result) });

/** Stores a finished game for the caregiver's history and report; fire and forget. */
export function recordGame(elderId: string, result: GamePlayedPayload): void {
  sender.record(elderId, result);
}
