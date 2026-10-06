import { addDays, instantOf, localDateOf, type AssistantMessageBody, type AssistantReply } from '@aurelia/shared';
import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import { AppError } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { EventsRepo } from '../../repos/events';
import type { OccurrencesRepo } from '../../repos/occurrences';
import type { RoutinesRepo } from '../../repos/routines';
import { toOccurrence } from '../agenda/serialize';
import { toRoutine } from '../routines/serialize';
import { buildSystemPrompt, dailySummaryRequest, hasSomethingToday, type PromptContext } from './prompt';
import type { LlmMessage, LlmProvider } from './provider';

interface Deps {
  llm: LlmProvider;
  routines: RoutinesRepo;
  occurrences: OccurrencesRepo;
  events: EventsRepo;
  now: Clock;
  logger: Logger;
  timeoutMs?: number;
}

const UNAVAILABLE = 'O assistente não está disponível agora. Tente de novo em instantes.';

export function createAssistantService({ llm, routines, occurrences, events, now, logger, timeoutMs = 15_000 }: Deps) {
  /** What the prompt is grounded in: the routines, the week's occurrences and (for caregivers) the week's events. */
  async function contextFor(elder: ElderDoc, role: 'caregiver' | 'elder', current: Date): Promise<PromptContext> {
    const today = localDateOf(current, elder.timezone);
    const weekStart = addDays(today, -6);
    const [routineDocs, occurrenceDocs, eventList] = await Promise.all([
      routines.list(elder.id),
      occurrences.between(elder.id, weekStart, today),
      // The elder only gets today's agenda; the week's events are for caregivers.
      role === 'caregiver'
        ? // `between` excludes its end, so step one millisecond past now to include an event stamped right now.
        events.between(elder.id, instantOf(weekStart, '00:00', elder.timezone), new Date(current.getTime() + 1))
        : Promise.resolve([]),
    ]);
    return {
      elder,
      now: current,
      routines: routineDocs.map(toRoutine),
      occurrences: occurrenceDocs.map(toOccurrence),
      events: eventList,
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
      const ctx = await contextFor(elder, role, now());
      try {
        const reply = await generate(elder, buildSystemPrompt(role, ctx), [
          ...body.history,
          { role: 'user', content: body.message },
        ]);
        return { reply };
      } catch (error) {
        logger.warn({ err: error, elderId: elder.id }, 'assistant request failed');
        throw new AppError('SERVICE_UNAVAILABLE', UNAVAILABLE);
      }
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
