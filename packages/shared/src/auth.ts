import { z } from 'zod';

import { IdSchema } from './primitives';

export const SignupBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});
export type SignupBody = z.infer<typeof SignupBodySchema>;

export const SignupResponseSchema = z.object({ id: IdSchema });
export type SignupResponse = z.infer<typeof SignupResponseSchema>;

export const PAIRING_CODE_LENGTH = 6;
/** No 0/O/1/I/L, so a code read aloud or copied from a screen is hard to get wrong. */
export const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Input is trimmed and upper-cased, so the elder can type the code in any case. */
export const PairingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${PAIRING_CODE_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`), 'Código inválido.');

export const PairBodySchema = z.strictObject({ code: PairingCodeSchema });
export type PairBody = z.infer<typeof PairBodySchema>;

export const PairResponseSchema = z.object({
  customToken: z.string().min(1),
  elder: z.object({ id: IdSchema, name: z.string() }),
});
export type PairResponse = z.infer<typeof PairResponseSchema>;
