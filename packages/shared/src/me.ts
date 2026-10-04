import { z } from 'zod';

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
