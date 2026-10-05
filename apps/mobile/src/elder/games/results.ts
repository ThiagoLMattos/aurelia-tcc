import type { GamePlayedPayload } from '@aurelia/shared';

import { ApiError } from '@/lib/api/client';

/** Longest and shortest duration the API accepts. */
const MIN_SECONDS = 1;
const MAX_SECONDS = 7_200;

/** Whole seconds since `startedAt`, inside what the API accepts. */
export function elapsedSeconds(startedAt: number, now: number = Date.now()): number {
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round((now - startedAt) / 1_000)));
}

export interface ResultSenderOptions {
  send: (elderId: string, result: GamePlayedPayload) => Promise<unknown>;
  /** Waits before attempt n+1. Its length is how many retries there are. */
  delaysMs?: readonly number[];
}

/**
 * Sends a finished game in the background, retrying a few times when the network fails. The elder never
 * sees an error for it: a result that does not get through is only missing from the caregiver's report.
 * It lives outside React, so leaving the game screen does not cancel it.
 */
export function createResultSender({ send, delaysMs = [3_000, 10_000, 30_000] }: ResultSenderOptions) {
  async function attempt(elderId: string, result: GamePlayedPayload, retry: number): Promise<void> {
    try {
      await send(elderId, result);
    } catch (error) {
      const rejected = error instanceof ApiError && error.status !== null && error.status < 500 && error.code !== 'RATE_LIMITED';
      const wait = delaysMs[retry];
      if (rejected || wait === undefined) return;
      setTimeout(() => void attempt(elderId, result, retry + 1), wait);
    }
  }

  return {
    record(elderId: string, result: GamePlayedPayload): void {
      void attempt(elderId, result, 0);
    },
  };
}
