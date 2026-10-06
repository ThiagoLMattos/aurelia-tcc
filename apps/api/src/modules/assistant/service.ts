import {
  addDays,
  ASSISTANT_CONVERSATION_IDLE_MIN,
  ASSISTANT_MEMORIES_IN_PROMPT,
  instantOf,
  localDateOf,
  type AssistantMemoriesResponse,
  type AssistantMessageBody,
  type AssistantReply,
} from '@aurelia/shared';
import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import { AppError } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { EventsRepo } from '../../repos/events';
import type { ConversationDoc, MemoriesRepo } from '../../repos/memories';
import type { OccurrencesRepo } from '../../repos/occurrences';
import type { RoutinesRepo } from '../../repos/routines';
import { toOccurrence } from '../agenda/serialize';
import { toRoutine } from '../routines/serialize';
import {
  buildSystemPrompt,
  conversationTranscript,
  dailySummaryRequest,
  hasSomethingToday,
  memorySystemPrompt,
  NOTHING_TO_REMEMBER,
  type PromptContext,
} from './prompt';
import type { LlmMessage, LlmProvider } from './provider';

interface Deps {
  llm: LlmProvider;
  routines: RoutinesRepo;
  occurrences: OccurrencesRepo;
  events: EventsRepo;
  memories: MemoriesRepo;
  now: Clock;
  logger: Logger;
  timeoutMs?: number;
}

const UNAVAILABLE = 'O assistente não está disponível agora. Tente de novo em instantes.';

const IDLE_MS = ASSISTANT_CONVERSATION_IDLE_MIN * 60_000;

export function createAssistantService({ llm, routines, occurrences, events, memories, now, logger, timeoutMs = 15_000 }: Deps) {
  /** What the prompt is grounded in: the routines, the week's occurrences and (for caregivers) the week's events. */
  async function contextFor(elder: ElderDoc, role: 'caregiver' | 'elder', current: Date): Promise<PromptContext> {
    const today = localDateOf(current, elder.timezone);
    const weekStart = addDays(today, -6);
    const [routineDocs, occurrenceDocs, eventList, memoryList] = await Promise.all([
      routines.list(elder.id),
      occurrences.between(elder.id, weekStart, today),
      // The elder only gets today's agenda; the week's events are for caregivers.
      role === 'caregiver'
        ? // `between` excludes its end, so step one millisecond past now to include an event stamped right now.
        events.between(elder.id, instantOf(weekStart, '00:00', elder.timezone), new Date(current.getTime() + 1))
        : Promise.resolve([]),
      memories.listMemories(elder.id, ASSISTANT_MEMORIES_IN_PROMPT),
    ]);
    return {
      elder,
      now: current,
      routines: routineDocs.map(toRoutine),
      occurrences: occurrenceDocs.map(toOccurrence),
      events: eventList,
      memories: memoryList,
    };
  }

  async function generate(elder: ElderDoc, system: string, messages: LlmMessage[]): Promise<string> {
    const signal = AbortSignal.timeout(timeoutMs);
    // The signal stops well-behaved providers; the race covers one that ignores it.
    const timedOut = new Promise<never>((_, reject) =>
      signal.addEventListener('abort', () => reject(new Error(`assistant timed out after ${timeoutMs} ms`))),
    );
    const text = await Promise.race([llm.generate({ system, messages, signal }), timedOut]);
    const reply = text.trim();
    if (!reply) throw new Error(`empty completion for elder ${elder.id}`);
    return reply;
  }

  return {
    async reply(elder: ElderDoc, role: 'caregiver' | 'elder', body: AssistantMessageBody): Promise<AssistantReply> {
      const current = now();
      const ctx = await contextFor(elder, role, current);
      let reply: string;
      try {
        reply = await generate(elder, buildSystemPrompt(role, ctx), [...body.history, { role: 'user', content: body.message }]);
      } catch (error) {
        logger.warn({ err: error, elderId: elder.id }, 'assistant request failed');
        throw new AppError('SERVICE_UNAVAILABLE', UNAVAILABLE);
      }
      // Only the elder's conversations become memories; a caregiver's questions are not about their life.
      if (role === 'elder') {
        await memories
          .recordExchange(elder.id, current, new Date(current.getTime() - IDLE_MS), [
            { role: 'user', content: body.message },
            { role: 'assistant', content: reply },
          ])
          .catch((error: unknown) => logger.warn({ err: error, elderId: elder.id }, 'could not keep the conversation for memory'));
      }
      return { reply };
    },

    /**
     * What Aurélia keeps from a finished conversation: a few sentences, or null when there was
     * nothing worth remembering. Throws when the model fails.
     */
    async summarizeConversation(elder: ElderDoc, conversation: ConversationDoc): Promise<string | null> {
      const date = localDateOf(conversation.startedAt, elder.timezone);
      const text = await generate(elder, memorySystemPrompt(elder), [
        { role: 'user', content: `Conversa de ${date}:\n${conversationTranscript(elder.name, conversation.turns)}` },
      ]);
      const summary = text.replace(/\s+/g, ' ').trim();
      return summary.toUpperCase().replace(/[.!]/g, '') === NOTHING_TO_REMEMBER ? null : summary;
    },

    /** For the caregivers: what Aurélia remembers, newest first. */
    async listMemories(elder: ElderDoc): Promise<AssistantMemoriesResponse> {
      const items = await memories.listMemories(elder.id, 100);
      return {
        items: items.map((memory) => ({ id: memory.id, at: memory.at.toISOString(), date: memory.date, summary: memory.summary })),
      };
    },

    async forget(elder: ElderDoc, memoryId: string): Promise<void> {
      if (!(await memories.deleteMemory(elder.id, memoryId))) throw new AppError('NOT_FOUND', 'Lembrança não encontrada.');
    },

    /**
     * Aurélia's summary of the elder's day so far, for the caregivers. Null on a day with nothing to
     * tell (no routine due and nothing on the timeline). Throws when the model fails.
     */
    async summarizeDay(elder: ElderDoc, at: Date = now()): Promise<string | null> {
      const ctx = await contextFor(elder, 'caregiver', at);
      if (!hasSomethingToday(ctx)) return null;
      return generate(elder, buildSystemPrompt('caregiver', ctx), [{ role: 'user', content: dailySummaryRequest(elder.name) }]);
    },
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
