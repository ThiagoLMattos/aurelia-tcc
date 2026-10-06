import { z } from 'zod';

/**
 * Metro inlines `process.env.EXPO_PUBLIC_*` only when the name is written out, so every variable is
 * listed here instead of reading `process.env` as a whole.
 */
const raw = {
  EXPO_PUBLIC_API_MODE: process.env.EXPO_PUBLIC_API_MODE,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
};

/** An unset (or empty) variable counts as missing. */
const optional = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional());

const EnvSchema = z
  .object({
    EXPO_PUBLIC_API_MODE: z.preprocess((value) => (value === '' ? undefined : value), z.enum(['api', 'mock']).default('api')),
    EXPO_PUBLIC_API_URL: optional,
    EXPO_PUBLIC_FIREBASE_API_KEY: optional,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: optional,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: optional,
    EXPO_PUBLIC_FIREBASE_APP_ID: optional,
    EXPO_PUBLIC_EAS_PROJECT_ID: optional,
    EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: optional,
  })
  .superRefine((value, ctx) => {
    if (value.EXPO_PUBLIC_API_MODE === 'mock') return;
    const required = [
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      'EXPO_PUBLIC_FIREBASE_APP_ID',
    ] as const;
    for (const name of required) {
      if (!value[name]) ctx.addIssue({ code: 'custom', path: [name], message: 'obrigatória no modo "api"' });
    }
  });

export interface Env {
  apiMode: 'api' | 'mock';
  /** Base URL including `/api/v1`, without a trailing slash. */
  apiUrl: string;
  firebase: { apiKey: string; authDomain: string; projectId: string; appId: string };
  /** Needed to get an Expo push token; push is skipped without it. */
  easProjectId: string | null;
  /** `host:port` of a local Firebase Auth emulator, for running the whole stack on one machine. */
  authEmulatorHost: string | null;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(
      `Configuração do app incompleta. Copie .env.example para .env e preencha:\n${lines.join('\n')}\n` +
        'Para rodar sem backend, use EXPO_PUBLIC_API_MODE=mock.',
    );
  }
  const data = result.data;
  return {
    apiMode: data.EXPO_PUBLIC_API_MODE,
    apiUrl: (data.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, ''),
    firebase: {
      apiKey: data.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      authDomain: data.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: data.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
      appId: data.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    },
    easProjectId: data.EXPO_PUBLIC_EAS_PROJECT_ID ?? null,
    authEmulatorHost: data.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? null,
  };
}

export const env: Env = parseEnv(raw);
