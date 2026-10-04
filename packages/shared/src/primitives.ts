import { z } from 'zod';

import { isValidTimezone } from './time';

export const IdSchema = z.string().min(1).max(128);
export type Id = z.infer<typeof IdSchema>;

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/** 'YYYY-MM-DD', local to the elder's timezone. */
export const LocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Data inválida.');
export type LocalDate = z.infer<typeof LocalDateSchema>;

/** 'HH:mm' (24h, zero padded), local to the elder's timezone. */
export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:mm.');
export type LocalTime = z.infer<typeof LocalTimeSchema>;

/** 0 = Sunday … 6 = Saturday. */
export const WeekdaySchema = z.number().int().min(0).max(6);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const PhoneE164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use o formato internacional (+5511999999999).');
export type PhoneE164 = z.infer<typeof PhoneE164Schema>;

export const LatSchema = z.number().min(-90).max(90);
export const LngSchema = z.number().min(-180).max(180);
export const LatLngSchema = z.strictObject({ lat: LatSchema, lng: LngSchema });
export type LatLng = z.infer<typeof LatLngSchema>;

export const TimezoneSchema = z.string().refine(isValidTimezone, 'Fuso horário inválido.');
export type Timezone = z.infer<typeof TimezoneSchema>;

export const ShortTextSchema = z.string().trim().min(1).max(120);
export const LongTextSchema = z.string().trim().max(500);
