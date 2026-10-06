import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema, LocalDateSchema } from './primitives';

export const AssistantRoleSchema = z.enum(['user', 'assistant']);

export const AssistantTurnSchema = z.strictObject({
  role: AssistantRoleSchema,
  content: z.string().min(1).max(2000),
});
export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;

export const AssistantMessageBodySchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  history: z.array(AssistantTurnSchema).max(20).default([]),
});
export type AssistantMessageBody = z.infer<typeof AssistantMessageBodySchema>;

export const AssistantReplySchema = z.object({ reply: z.string() });
export type AssistantReply = z.infer<typeof AssistantReplySchema>;

/** What Aurélia keeps from one conversation with the elder: a few sentences, never the conversation itself. */
export const AssistantMemorySchema = z.object({
  id: IdSchema,
  /** When the conversation started. */
  at: IsoDateTimeSchema,
  date: LocalDateSchema,
  summary: z.string(),
});
export type AssistantMemory = z.infer<typeof AssistantMemorySchema>;

/** GET /elders/:elderId/assistant/memories, newest first. */
export const AssistantMemoriesResponseSchema = z.object({ items: z.array(AssistantMemorySchema) });
export type AssistantMemoriesResponse = z.infer<typeof AssistantMemoriesResponseSchema>;

export const AssistantMemoryParamsSchema = z.object({ elderId: IdSchema, memoryId: IdSchema });
export type AssistantMemoryParams = z.infer<typeof AssistantMemoryParamsSchema>;
