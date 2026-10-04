import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema, LocalTimeSchema, ShortTextSchema, WeekdaySchema, LongTextSchema } from './primitives';

export const RoutineTypeSchema = z.enum(['medication', 'meal', 'activity', 'custom']);
export type RoutineType = z.infer<typeof RoutineTypeSchema>;

export const MedicationSchema = z.strictObject({
  dosage: ShortTextSchema,
  form: ShortTextSchema,
});
export type Medication = z.infer<typeof MedicationSchema>;

const WeekdaysSchema = z
  .array(WeekdaySchema)
  .min(1, 'Escolha ao menos um dia.')
  .max(7)
  .refine((days) => new Set(days).size === days.length, 'Dias repetidos.');

export const RoutineSchema = z.object({
  id: IdSchema,
  type: RoutineTypeSchema,
  name: z.string(),
  description: z.string(),
  time: LocalTimeSchema,
  weekdays: z.array(WeekdaySchema),
  medication: MedicationSchema.nullable(),
  remindElder: z.boolean(),
  alertIfMissed: z.boolean(),
  active: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Routine = z.infer<typeof RoutineSchema>;

export const RoutinesResponseSchema = z.object({ items: z.array(RoutineSchema) });
export type RoutinesResponse = z.infer<typeof RoutinesResponseSchema>;

export const CreateRoutineBodySchema = z
  .strictObject({
    type: RoutineTypeSchema,
    name: ShortTextSchema,
    description: LongTextSchema.default(''),
    time: LocalTimeSchema,
    weekdays: WeekdaysSchema,
    medication: MedicationSchema.optional(),
    remindElder: z.boolean().default(true),
    alertIfMissed: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .superRefine((body, ctx) => {
    if (body.type === 'medication' && !body.medication) {
      ctx.addIssue({ code: 'custom', path: ['medication'], message: 'Informe dose e forma do medicamento.' });
    }
    if (body.type !== 'medication' && body.medication) {
      ctx.addIssue({ code: 'custom', path: ['medication'], message: 'Só medicamentos têm dose e forma.' });
    }
  });
export type CreateRoutineBody = z.infer<typeof CreateRoutineBodySchema>;

export const PatchRoutineBodySchema = z
  .strictObject({
    type: RoutineTypeSchema,
    name: ShortTextSchema,
    description: LongTextSchema,
    time: LocalTimeSchema,
    weekdays: WeekdaysSchema,
    medication: MedicationSchema,
    remindElder: z.boolean(),
    alertIfMissed: z.boolean(),
    active: z.boolean(),
  })
  .partial()
  .superRefine((body, ctx) => {
    if (Object.keys(body).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Envie ao menos um campo.' });
    }
    if (body.type === 'medication' && !body.medication) {
      ctx.addIssue({ code: 'custom', path: ['medication'], message: 'Informe dose e forma do medicamento.' });
    }
    if (body.type !== undefined && body.type !== 'medication' && body.medication) {
      ctx.addIssue({ code: 'custom', path: ['medication'], message: 'Só medicamentos têm dose e forma.' });
    }
  });
export type PatchRoutineBody = z.infer<typeof PatchRoutineBodySchema>;

export const RoutineParamsSchema = z.object({ elderId: IdSchema, routineId: IdSchema });
export type RoutineParams = z.infer<typeof RoutineParamsSchema>;
