import type { ErrorCode } from '@aurelia/shared';

import { ApiError, type ApiErrorCode } from '@/lib/api/client';

/** Fallback copy when the API's own message is not suitable to show as is. */
const CODE_MESSAGES: Record<ApiErrorCode | ErrorCode, string> = {
  VALIDATION_ERROR: 'Confira os dados informados e tente novamente.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
  FORBIDDEN: 'Você não tem permissão para fazer isso.',
  NOT_FOUND: 'Não encontramos o que você procurou.',
  CONFLICT: 'Isso já foi feito ou entrou em conflito com outra alteração.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  INTERNAL: 'Algo deu errado do nosso lado. Tente novamente.',
  SERVICE_UNAVAILABLE: 'O serviço está indisponível no momento. Tente de novo em instantes.',
  NETWORK: 'Sem conexão com o servidor. Verifique sua internet.',
  TIMEOUT: 'O servidor demorou para responder. Tente novamente.',
};

/** Firebase Auth errors the sign-in forms can run into, by `error.code`. */
const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  'auth/network-request-failed': CODE_MESSAGES.NETWORK,
  'auth/invalid-custom-token': 'Não foi possível entrar com este código. Gere um novo.',
  'auth/custom-token-mismatch': 'Não foi possível entrar com este código. Gere um novo.',
};

/** Messages that are the same for every endpoint and better said our way than by the server's text. */
const OVERRIDE_CODES: ReadonlySet<string> = new Set(['NETWORK', 'TIMEOUT', 'INTERNAL', 'SERVICE_UNAVAILABLE', 'RATE_LIMITED']);

/** Turns anything thrown by the API client or Firebase Auth into a message that is safe to show. */
export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (OVERRIDE_CODES.has(error.code) || !error.message) return CODE_MESSAGES[error.code];
    return error.message;
  }
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code.startsWith('auth/')) return FIREBASE_AUTH_MESSAGES[code] ?? 'Não foi possível entrar. Tente novamente.';
  return CODE_MESSAGES.INTERNAL;
}
