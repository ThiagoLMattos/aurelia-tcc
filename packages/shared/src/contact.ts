import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema, PhoneE164Schema, ShortTextSchema } from './primitives';

export const ContactSchema = z.object({
  id: IdSchema,
  name: z.string(),
  phone: PhoneE164Schema,
  relation: z.string(),
  isEmergency: z.boolean(),
  priority: z.number().int(),
  createdAt: IsoDateTimeSchema,
});
export type Contact = z.infer<typeof ContactSchema>;

export const ContactsResponseSchema = z.object({ items: z.array(ContactSchema) });
export type ContactsResponse = z.infer<typeof ContactsResponseSchema>;

export const CreateContactBodySchema = z.strictObject({
  name: ShortTextSchema,
  phone: PhoneE164Schema,
  relation: ShortTextSchema,
  isEmergency: z.boolean().default(false),
  priority: z.number().int().min(0).max(1000).default(100),
});
export type CreateContactBody = z.infer<typeof CreateContactBodySchema>;

export const PatchContactBodySchema = z
  .strictObject({
    name: ShortTextSchema,
    phone: PhoneE164Schema,
    relation: ShortTextSchema,
    isEmergency: z.boolean(),
    priority: z.number().int().min(0).max(1000),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Envie ao menos um campo.');
export type PatchContactBody = z.infer<typeof PatchContactBodySchema>;

export const ContactParamsSchema = z.object({ elderId: IdSchema, contactId: IdSchema });
export type ContactParams = z.infer<typeof ContactParamsSchema>;
