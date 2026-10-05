import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes, URL-safe. Shown to the caregiver once; only its hash is stored. */
export const generateSecret = (): string => randomBytes(32).toString('base64url');

export const hashSecret = (secret: string): string => createHash('sha256').update(secret).digest('hex');

/** Compares hashes (not secrets) in constant time. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
