import { z } from 'zod';

import { PairingCodeSchema } from './auth';
import { ElderSchema } from './elder';
import { IdSchema, IsoDateTimeSchema } from './primitives';

export const EscalationSchema = z.enum(['meOnly', 'meThenContacts']);
export type Escalation = z.infer<typeof EscalationSchema>;

export const CaregiverSettingsSchema = z.strictObject({
  notifyMissedTask: z.boolean(),
  notifyConfirmations: z.boolean(),
  notifyAssistantInsights: z.boolean(),
  escalation: EscalationSchema,
});
export type CaregiverSettings = z.infer<typeof CaregiverSettingsSchema>;

export const DEFAULT_CAREGIVER_SETTINGS: CaregiverSettings = {
  notifyMissedTask: true,
  notifyConfirmations: true,
  notifyAssistantInsights: true,
  escalation: 'meOnly',
};

export const CaregiverSchema = z.object({
  id: IdSchema,
  name: z.string(),
  email: z.email(),
  settings: CaregiverSettingsSchema,
  createdAt: IsoDateTimeSchema,
});
export type Caregiver = z.infer<typeof CaregiverSchema>;

export const MeResponseSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('caregiver'),
    caregiver: CaregiverSchema,
    elders: z.array(ElderSchema),
  }),
  z.object({
    role: z.literal('elder'),
    elder: ElderSchema,
  }),
]);
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const PatchMeBodySchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    settings: CaregiverSettingsSchema.partial(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Envie ao menos um campo.');
export type PatchMeBody = z.infer<typeof PatchMeBodySchema>;

export const ExpoPushTokenSchema = z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Token de push inválido.');

export const PushTokenBodySchema = z.strictObject({ token: ExpoPushTokenSchema });
export type PushTokenBody = z.infer<typeof PushTokenBodySchema>;

export const PushTokenParamsSchema = z.object({ token: z.string().min(1) });
export type PushTokenParams = z.infer<typeof PushTokenParamsSchema>;

/**
 * POST /elders/:elderId/caregiver-invites. Without `renew` the elder's invite still waiting to be used
 * is returned as is, so opening the invite screen again never cancels a code already sent.
 */
export const CaregiverInviteQuerySchema = z.object({
  renew: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type CaregiverInviteQuery = z.infer<typeof CaregiverInviteQuerySchema>;

/** POST /me/elders: a caregiver joins an elder with an invite another caregiver of that elder issued. */
export const JoinElderBodySchema = z.strictObject({ code: PairingCodeSchema });
export type JoinElderBody = z.infer<typeof JoinElderBodySchema>;

/** One of the caregivers following an elder, as the others see them. */
export const ElderCaregiverSchema = z.object({
  id: IdSchema,
  name: z.string(),
  email: z.string(),
});
export type ElderCaregiver = z.infer<typeof ElderCaregiverSchema>;

/** GET /elders/:elderId/caregivers */
export const ElderCaregiversResponseSchema = z.object({ items: z.array(ElderCaregiverSchema) });
export type ElderCaregiversResponse = z.infer<typeof ElderCaregiversResponseSchema>;

export const CaregiverParamsSchema = z.object({ elderId: IdSchema, caregiverId: IdSchema });
export type CaregiverParams = z.infer<typeof CaregiverParamsSchema>;
