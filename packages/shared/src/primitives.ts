import { z } from 'zod';

import { isValidTimezone } from './time';

/** Rejects what Firestore refuses as a document id (`.`, `..`, `__x__`), so those never reach it. */
export const IdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^(?!\.{1,2}$)(?!__.*__$)[^/]+$/, 'Identificador inválido.');
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

/**
 * Turns what people type ("(11) 99999-9999", "11999999999", "5511999999999", "0055…") into E.164.
 * Numbers without a country code are taken as Brazilian; anything else is left to fail validation.
 */
export function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s().-]/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (/^\d{10,11}$/.test(compact)) return `+55${compact}`;
  if (/^55\d{10,11}$/.test(compact)) return `+${compact}`;
  return compact;
}

/** Request-body phone: accepts common formats and outputs E.164. */
export const PhoneInputSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(PhoneE164Schema);

export const LatSchema = z.number().min(-90).max(90);
export const LngSchema = z.number().min(-180).max(180);
export const LatLngSchema = z.strictObject({ lat: LatSchema, lng: LngSchema });
export type LatLng = z.infer<typeof LatLngSchema>;

export const TimezoneSchema = z.string().refine(isValidTimezone, 'Fuso horário inválido.');
export type Timezone = z.infer<typeof TimezoneSchema>;

export const ShortTextSchema = z.string().trim().min(1).max(120);
export const LongTextSchema = z.string().trim().max(500);
