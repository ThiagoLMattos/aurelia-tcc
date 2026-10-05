import type { Timestamp } from 'firebase-admin/firestore';

export const toDate = (value: Timestamp): Date => value.toDate();
export const toDateOrNull = (value: Timestamp | null | undefined): Date | null => (value ? value.toDate() : null);

/** gRPC status 5: the document does not exist (e.g. update() on a missing doc). */
export function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 5;
}

/** gRPC status 6: create() on a document that already exists. */
export function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 6;
}
