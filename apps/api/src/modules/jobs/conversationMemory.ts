import { ASSISTANT_CONVERSATION_IDLE_MIN, localDateOf } from '@aurelia/shared';
import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import type { EldersRepo } from '../../repos/elders';
import type { MemoriesRepo } from '../../repos/memories';
import type { AssistantService } from '../assistant/service';

interface Deps {
  elders: EldersRepo;
  memories: MemoriesRepo;
  assistant: AssistantService;
  now: Clock;
  logger: Logger;
}

/** A conversation whose summary failed this many times is dropped rather than kept forever. */
const MAX_ATTEMPTS = 5;

/**
 * Aurélia's memory: every conversation the elder had with her that has been quiet for
 * ASSISTANT_CONVERSATION_IDLE_MIN becomes a few sentences she reads next time, and the conversation
 * itself is deleted. Runs with the other periodic jobs; returns how many memories were kept.
 */
export function createConversationMemoryJob({ elders, memories, assistant, now, logger }: Deps) {
  return {
    async run(at: Date = now()): Promise<number> {
      const idleSince = new Date(at.getTime() - ASSISTANT_CONVERSATION_IDLE_MIN * 60_000);
      let kept = 0;
      for (const elder of await elders.listAll()) {
        let finished;
        try {
          finished = await memories.finishedConversations(elder.id, idleSince);
        } catch (error) {
          logger.warn({ err: error, elderId: elder.id }, 'could not list finished conversations');
          continue;
        }
        for (const conversation of finished) {
          try {
            const summary = await assistant.summarizeConversation(elder, conversation);
            const date = localDateOf(conversation.startedAt, elder.timezone);
            await memories.keepSummary(elder.id, conversation, summary ? { date, summary } : null);
            if (summary) kept += 1;
          } catch (error) {
            const attempts = conversation.attempts + 1;
            logger.warn({ err: error, elderId: elder.id, attempts }, 'conversation summary failed');
            await (attempts >= MAX_ATTEMPTS
              ? memories.keepSummary(elder.id, conversation, null)
              : memories.countFailure(elder.id, conversation.id, attempts)
            ).catch(() => undefined);
          }
        }
      }
      return kept;
    },
  };
}

export type ConversationMemoryJob = ReturnType<typeof createConversationMemoryJob>;
