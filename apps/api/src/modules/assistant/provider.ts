import Groq from 'groq-sdk';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  signal?: AbortSignal;
}

/** The only thing the assistant needs from a model vendor (spec §7). */
export interface LlmProvider {
  generate(request: LlmRequest): Promise<string>;
}

export function createGroqProvider({ apiKey, model }: { apiKey: string; model: string }): LlmProvider {
  const client = new Groq({ apiKey });
  return {
    async generate({ system, messages, signal }) {
      const completion = await client.chat.completions.create(
        {
          model,
          temperature: 0.4,
          max_completion_tokens: 600,
          messages: [{ role: 'system', content: system }, ...messages],
        },
        signal ? { signal } : undefined,
      );
      return completion.choices[0]?.message.content ?? '';
    },
  };
}

/** Deterministic stand-in for tests and for running without a key (LLM_PROVIDER=fake). */
export function createFakeProvider(): LlmProvider {
  return {
    async generate({ messages }) {
      const last = messages.at(-1)?.content ?? '';
      return `[assistente de teste] Recebi: ${last}`;
    },
  };
}

export function createLlmProvider(config: { LLM_PROVIDER: 'groq' | 'fake'; GROQ_API_KEY?: string | undefined; LLM_MODEL?: string | undefined }): LlmProvider {
  if (config.LLM_PROVIDER === 'fake') return createFakeProvider();
  // loadConfig guarantees both are present for groq.
  return createGroqProvider({ apiKey: config.GROQ_API_KEY as string, model: config.LLM_MODEL as string });
}
