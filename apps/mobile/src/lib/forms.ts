import type { ZodType } from 'zod';

export type FormResult<T> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

/**
 * Validates form values with a shared schema. The schemas' own messages are not always Portuguese,
 * so each form passes the message to show per field; the first failing field wins its message.
 */
export function validateForm<T>(schema: ZodType<T>, values: unknown, messages: Record<string, string>): FormResult<T> {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '');
    errors[field] ??= messages[field] ?? issue.message;
  }
  return { ok: false, errors };
}

/** 'DD/MM/AAAA' as typed (with the slashes added while typing) → 'AAAA-MM-DD'. Anything else is returned as is. */
export function brDateToIso(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

/** Adds the slashes to a date while it is typed: '15031947' → '15/03/1947'. */
export function maskBrDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
