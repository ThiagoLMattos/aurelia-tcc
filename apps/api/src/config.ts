import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    FIREBASE_PROJECT_ID: z.string().min(1, 'is required'),
    USE_EMULATORS: booleanString.default(false),
    FIRESTORE_EMULATOR_HOST: z.string().min(1).default('127.0.0.1:8080'),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).default('127.0.0.1:9099'),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    LLM_PROVIDER: z.enum(['groq', 'fake']).default('groq'),
    GROQ_API_KEY: z.string().min(1).optional(),
    LLM_MODEL: z.string().min(1).optional(),
    /** Enables POST /internal/jobs/run (for deployments where the in-process scheduler cannot run). */
    JOBS_TOKEN: z.string().min(16, 'must be at least 16 characters').optional(),
    /**
     * Reverse proxies in front of the API whose X-Forwarded-For is trusted (Cloud Run: 1). Without it every
     * client shares the proxy's address and the per-IP rate limits throttle everyone together.
     */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    /** Set to false to run the API without the in-process scheduler (e.g. an external trigger calls the jobs). */
    SCHEDULER_ENABLED: booleanString.default(true),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER !== 'groq') return;
    for (const key of ['GROQ_API_KEY', 'LLM_MODEL'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'is required when LLM_PROVIDER=groq' });
    }
  });

export type Config = z.infer<typeof EnvSchema>;

/** Parses and validates the environment. Throws one readable error listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example at the repository root.`);
  }
  return result.data;
}
