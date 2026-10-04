import { z } from 'zod';

import { DEFAULT_MISSED_TASK_TIMEOUT_MIN, DEFAULT_TIMEZONE } from './constants';
import { IdSchema, IsoDateTimeSchema, LatSchema, LngSchema, LocalDateSchema, ShortTextSchema, TimezoneSchema } from './primitives';

export const DiagnosisStageSchema = z.enum(['early', 'moderate', 'advanced']);
export type DiagnosisStage = z.infer<typeof DiagnosisStageSchema>;

export const MissedTaskTimeoutSchema = z.union([z.literal(15), z.literal(30), z.literal(60)]);

export const SafeZoneSchema = z.strictObject({
  lat: LatSchema,
  lng: LngSchema,
  radiusM: z.number().min(50).max(5000),
});
export type SafeZone = z.infer<typeof SafeZoneSchema>;

export const LocationStatusSchema = z.enum(['inside', 'outside', 'unknown']);
export type LocationStatus = z.infer<typeof LocationStatusSchema>;

export const LocationStateSchema = z.object({
  status: LocationStatusSchema,
  since: IsoDateTimeSchema.nullable(),
  lastLat: LatSchema.nullable(),
  lastLng: LngSchema.nullable(),
  lastAt: IsoDateTimeSchema.nullable(),
  consecutiveOutside: z.number().int().min(0),
  consecutiveInside: z.number().int().min(0),
});
export type LocationState = z.infer<typeof LocationStateSchema>;

export const INITIAL_LOCATION_STATE: LocationState = {
  status: 'unknown',
  since: null,
  lastLat: null,
  lastLng: null,
  lastAt: null,
  consecutiveOutside: 0,
  consecutiveInside: 0,
};

export const ElderSchema = z.object({
  id: IdSchema,
  name: z.string(),
  birthDate: LocalDateSchema,
  diagnosisStage: DiagnosisStageSchema,
  timezone: z.string(),
  missedTaskTimeoutMin: MissedTaskTimeoutSchema,
  safeZone: SafeZoneSchema.nullable(),
  locationState: LocationStateSchema,
  /** True while an elder phone is signed in (has push tokens / active pairing). */
  phonePaired: z.boolean(),
  createdAt: IsoDateTimeSchema,
});
export type Elder = z.infer<typeof ElderSchema>;

export const DeviceSummarySchema = z.object({
  id: IdSchema,
  label: z.string(),
  lastSeenAt: IsoDateTimeSchema.nullable(),
  batteryPct: z.number().min(0).max(100).nullable(),
});
export type DeviceSummary = z.infer<typeof DeviceSummarySchema>;

/** GET /elders/:elderId */
export const ElderDetailResponseSchema = ElderSchema.extend({
  devices: z.array(DeviceSummarySchema),
});
export type ElderDetailResponse = z.infer<typeof ElderDetailResponseSchema>;

export const CreateElderBodySchema = z.strictObject({
  name: ShortTextSchema,
  birthDate: LocalDateSchema,
  diagnosisStage: DiagnosisStageSchema,
  timezone: TimezoneSchema.default(DEFAULT_TIMEZONE),
  missedTaskTimeoutMin: MissedTaskTimeoutSchema.default(DEFAULT_MISSED_TASK_TIMEOUT_MIN),
  safeZone: SafeZoneSchema.nullable().default(null),
});
export type CreateElderBody = z.infer<typeof CreateElderBodySchema>;

export const PatchElderBodySchema = z
  .strictObject({
    name: ShortTextSchema,
    birthDate: LocalDateSchema,
    diagnosisStage: DiagnosisStageSchema,
    timezone: TimezoneSchema,
    missedTaskTimeoutMin: MissedTaskTimeoutSchema,
    safeZone: SafeZoneSchema.nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Envie ao menos um campo.');
export type PatchElderBody = z.infer<typeof PatchElderBodySchema>;

export const PairingCodeResponseSchema = z.object({
  code: z.string(),
  expiresAt: IsoDateTimeSchema,
});
export type PairingCodeResponse = z.infer<typeof PairingCodeResponseSchema>;

export const ElderParamsSchema = z.object({ elderId: IdSchema });
export type ElderParams = z.infer<typeof ElderParamsSchema>;
