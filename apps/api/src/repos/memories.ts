import type { AssistantTurn, LocalDate } from '@aurelia/shared';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { toDate } from './convert';

/** The elder's conversation with Aurélia while it lasts. Deleted once it has been summarised. */
export interface ConversationDoc {
  id: string;
  startedAt: Date;
  lastAt: Date;
  turns: AssistantTurn[];
  /** Failed summaries so far; a conversation that keeps failing is dropped instead of retried forever. */
  attempts: number;
}

/** What Aurélia remembers from one conversation. */
export interface MemoryDoc {
  id: string;
  at: Date;
  date: LocalDate;
  summary: string;
}

interface ConversationData {
  startedAt: Timestamp;
  lastAt: Timestamp;
  turns: AssistantTurn[];
  attempts?: number;
}

interface MemoryData {
  at: Timestamp;
  date: LocalDate;
  summary: string;
}

/** The turns kept from one conversation (the newest ones); enough for a summary. */
const MAX_TURNS = 60;

const toConversation = (snap: FirebaseFirestore.DocumentSnapshot): ConversationDoc => {
  const data = snap.data() as ConversationData;
  return {
    id: snap.id,
    startedAt: toDate(data.startedAt),
    lastAt: toDate(data.lastAt),
    turns: data.turns ?? [],
    attempts: data.attempts ?? 0,
  };
};

const toMemory = (snap: FirebaseFirestore.DocumentSnapshot): MemoryDoc => {
  const data = snap.data() as MemoryData;
  return { id: snap.id, at: toDate(data.at), date: data.date, summary: data.summary };
};

export function createMemoriesRepo(db: Firestore) {
  const elder = (elderId: string) => db.collection('elders').doc(elderId);
  const conversations = (elderId: string) => elder(elderId).collection('conversations');
  const memories = (elderId: string) => elder(elderId).collection('memories');

  return {
    /**
     * Adds an exchange to the elder's current conversation, or starts a new one when the last one
     * has been quiet since before `idleSince` (that one is left for the summary job).
     */
    async recordExchange(elderId: string, at: Date, idleSince: Date, turns: AssistantTurn[]): Promise<void> {
      const latestQuery = conversations(elderId).orderBy('lastAt', 'desc').limit(1);
      await db.runTransaction(async (tx) => {
        const [latest] = (await tx.get(latestQuery)).docs;
        const current = latest ? toConversation(latest) : null;
        if (latest && current && current.lastAt.getTime() >= idleSince.getTime()) {
          tx.update(latest.ref, { lastAt: Timestamp.fromDate(at), turns: [...current.turns, ...turns].slice(-MAX_TURNS) });
          return;
        }
        tx.create(conversations(elderId).doc(), {
          startedAt: Timestamp.fromDate(at),
          lastAt: Timestamp.fromDate(at),
          turns: turns.slice(-MAX_TURNS),
          attempts: 0,
        } satisfies ConversationData);
      });
    },

    /** Conversations quiet since before `idleSince`, oldest first. */
    async finishedConversations(elderId: string, idleSince: Date): Promise<ConversationDoc[]> {
      const snaps = await conversations(elderId).where('lastAt', '<', Timestamp.fromDate(idleSince)).orderBy('lastAt').get();
      return snaps.docs.map(toConversation);
    },

    /** Stores the summary and deletes the conversation it came from, together. A null summary only deletes. */
    async keepSummary(elderId: string, conversation: ConversationDoc, memory: { date: LocalDate; summary: string } | null): Promise<void> {
      const batch = db.batch();
      if (memory) {
        batch.create(memories(elderId).doc(), {
          at: Timestamp.fromDate(conversation.startedAt),
          date: memory.date,
          summary: memory.summary,
        } satisfies MemoryData);
      }
      batch.delete(conversations(elderId).doc(conversation.id));
      await batch.commit();
    },

    async countFailure(elderId: string, conversationId: string, attempts: number): Promise<void> {
      await conversations(elderId).doc(conversationId).update({ attempts });
    },

    /** Newest first. */
    async listMemories(elderId: string, limit: number): Promise<MemoryDoc[]> {
      const snaps = await memories(elderId).orderBy('at', 'desc').limit(limit).get();
      return snaps.docs.map(toMemory);
    },

    /** Returns false when there was no such memory. */
    async deleteMemory(elderId: string, memoryId: string): Promise<boolean> {
      const ref = memories(elderId).doc(memoryId);
      if (!(await ref.get()).exists) return false;
      await ref.delete();
      return true;
    },
  };
}

export type MemoriesRepo = ReturnType<typeof createMemoriesRepo>;
