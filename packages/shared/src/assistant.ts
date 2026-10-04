import { z } from 'zod';

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
