import { z } from 'zod';

import { LocationStatusSchema } from './elder';
import { IdSchema, IsoDateTimeSchema, LatSchema, LngSchema } from './primitives';

export const DeviceSchema = z.object({
  id: IdSchema,
  label: z.string(),
  createdAt: IsoDateTimeSchema,
  lastSeenAt: IsoDateTimeSchema.nullable(),
  batteryPct: z.number().min(0).max(100).nullable(),
  firmwareVersion: z.string().nullable(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const CreateDeviceBodySchema = z.strictObject({ label: z.string().trim().min(1).max(60) });
export type CreateDeviceBody = z.infer<typeof CreateDeviceBodySchema>;

/** The secret is returned exactly once. */
export const CreateDeviceResponseSchema = z.object({ deviceId: IdSchema, secret: z.string().min(1) });
export type CreateDeviceResponse = z.infer<typeof CreateDeviceResponseSchema>;

export const DeviceParamsSchema = z.object({ elderId: IdSchema, deviceId: IdSchema });
export type DeviceParams = z.infer<typeof DeviceParamsSchema>;

export const DeviceHeadersSchema = z.object({
  'x-device-id': IdSchema,
  'x-device-secret': z.string().min(1),
});
export type DeviceHeaders = z.infer<typeof DeviceHeadersSchema>;

export const DeviceLocationBodySchema = z.strictObject({
  lat: LatSchema,
  lng: LngSchema,
  accuracyM: z.number().min(0).optional(),
  batteryPct: z.number().min(0).max(100).optional(),
  fwVersion: z.string().max(40).optional(),
});
export type DeviceLocationBody = z.infer<typeof DeviceLocationBodySchema>;

export const DeviceLocationResponseSchema = z.object({ ok: z.literal(true) });
export type DeviceLocationResponse = z.infer<typeof DeviceLocationResponseSchema>;

/** GET /elders/:elderId/location */
export const LocationResponseSchema = z.object({
  status: LocationStatusSchema,
  since: IsoDateTimeSchema.nullable(),
  lat: LatSchema.nullable(),
  lng: LngSchema.nullable(),
  at: IsoDateTimeSchema.nullable(),
});
export type LocationResponse = z.infer<typeof LocationResponseSchema>;
