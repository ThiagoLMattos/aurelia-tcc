import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    FIREBASE_PROJECT_ID: z.string().min(1, 'is required'),
    /**
     * The Firebase service account key file's JSON, for hosts outside Google Cloud (Render). Without it
     * the Admin SDK uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS, Cloud Run).
     */
    FIREBASE_SERVICE_ACCOUNT: z.string().min(1).optional(),
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
    /** How alerts reach the emergency contacts: `twilio` texts them, `log` only writes the text to the log. */
    SMS_PROVIDER: z.enum(['twilio', 'log']).default('log'),
    TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    /** A Twilio number in E.164 (+1…) or a Messaging Service SID (MG…). */
    TWILIO_FROM: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER === 'groq') {
      for (const key of ['GROQ_API_KEY', 'LLM_MODEL'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'is required when LLM_PROVIDER=groq' });
      }
    }
    if (env.FIREBASE_SERVICE_ACCOUNT) {
      // Never echo the value: it holds a private key.
      const key = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
      if (!key) {
        ctx.addIssue({ code: 'custom', path: ['FIREBASE_SERVICE_ACCOUNT'], message: 'must be the service account key JSON (project_id, client_email, private_key)' });
      } else if (key.projectId !== env.FIREBASE_PROJECT_ID) {
        ctx.addIssue({ code: 'custom', path: ['FIREBASE_SERVICE_ACCOUNT'], message: 'belongs to another project than FIREBASE_PROJECT_ID' });
      }
    }
    if (env.SMS_PROVIDER === 'twilio') {
      for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'is required when SMS_PROVIDER=twilio' });
      }
    }
  });

export type Config = z.infer<typeof EnvSchema>;

export interface ServiceAccountKey {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** The fields firebase-admin needs from a service account key file, or null when it is not one. */
export function parseServiceAccount(json: string): ServiceAccountKey | null {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = raw;
    if (typeof projectId !== 'string' || typeof clientEmail !== 'string' || typeof privateKey !== 'string') return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

/** Parses and validates the environment. Throws one readable error listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example at the repository root.`);
  }
  return result.data;
}
