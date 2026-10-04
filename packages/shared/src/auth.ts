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
export const PairingCodeSchema = z.string().regex(/^\d{6}$/, 'O código tem 6 dígitos.');

export const PairBodySchema = z.strictObject({ code: PairingCodeSchema });
export type PairBody = z.infer<typeof PairBodySchema>;

export const PairResponseSchema = z.object({
  customToken: z.string().min(1),
  elder: z.object({ id: IdSchema, name: z.string() }),
});
export type PairResponse = z.infer<typeof PairResponseSchema>;
