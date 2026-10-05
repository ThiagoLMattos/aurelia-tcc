import type { SosBody } from '@aurelia/shared';

import { ApiError } from '@/lib/api/client';

export type SosStatus = 'idle' | 'sending' | 'retrying' | 'sent' | 'failed';

export interface SosSenderOptions {
  send: (body: SosBody) => Promise<unknown>;
  /** Waits before attempt n+1; the last entry repeats. */
  delaysMs?: readonly number[];
  maxAttempts?: number;
}

/** 4xx answers (except "slow down") will not change on a retry; network trouble and 5xx might. */
function worthRetrying(error: unknown): boolean {
  if (error instanceof ApiError && error.status !== null && error.status < 500) return error.code === 'RATE_LIMITED';
  return true;
}

/**
 * Sends an SOS and keeps trying until the API has it. It lives outside React on purpose: leaving the
 * SOS screen must not cancel a request that has not got through yet. The state is in memory only
 * (a killed app forgets it; the elder has already been offered the phone call by then).
 */
export function createSosSender(options: SosSenderOptions) {
  const { send, delaysMs = [2_000, 5_000, 10_000, 20_000, 30_000], maxAttempts = 20 } = options;
  let status: SosStatus = 'idle';
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const set = (next: SosStatus) => {
    status = next;
    listeners.forEach((listener) => listener());
  };

  async function attempt(body: SosBody, number: number, run: number): Promise<void> {
    try {
      await send(body);
      if (run === generation) set('sent');
    } catch (error) {
      if (run !== generation) return;
      if (!worthRetrying(error) || number >= maxAttempts) return set('failed');
      set('retrying');
      const wait = delaysMs[Math.min(number - 1, delaysMs.length - 1)] ?? 30_000;
      timer = setTimeout(() => void attempt(body, number + 1, run), wait);
    }
  }

  return {
    /** Starts a new SOS (replacing any earlier one that is still retrying). */
    start(body: SosBody): void {
      generation += 1;
      clearTimeout(timer);
      set('sending');
      void attempt(body, 1, generation);
    },
    getStatus: () => status,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset(): void {
      generation += 1;
      clearTimeout(timer);
      set('idle');
    },
  };
}
