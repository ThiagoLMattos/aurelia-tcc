import { ApiErrorBodySchema, type ErrorCode } from '@aurelia/shared';
import type { ZodType } from 'zod';

export const REQUEST_TIMEOUT_MS = 15_000;

/** `NETWORK` and `TIMEOUT` never reached the API; every other code comes from its error body. */
export type ApiErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number | null = null,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions<T> {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Validates (and types) the response body. Omit for responses with no body. */
  schema?: ZodType<T>;
  /** Public routes (signup, pair) skip the Authorization header. */
  auth?: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Returns a valid Firebase ID token (refreshed when needed), or null when signed out. */
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  request<T = void>(method: string, path: string, options?: RequestOptions<T>): Promise<T>;
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions<unknown>['query']): string {
  const params = Object.entries(query ?? {}).filter((entry): entry is [string, string | number] => entry[1] !== undefined);
  const search = params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
  return `${baseUrl}${path}${search ? `?${search}` : ''}`;
}

/**
 * fetch wrapper for the Aurélia API: base URL, Bearer ID token, JSON, a 15 s timeout, and API errors
 * turned into `ApiError`. A 401 on an authenticated call is retried once with a freshly minted token,
 * because the cached one may have been revoked or may have just expired.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const { baseUrl, getToken, timeoutMs = REQUEST_TIMEOUT_MS, fetchImpl = fetch } = config;

  async function send(method: string, path: string, options: RequestOptions<unknown>, forceRefresh: boolean): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.auth !== false) {
      const token = await getToken(forceRefresh);
      if (!token) throw new ApiError('UNAUTHENTICATED', 'Sessão expirada. Entre novamente.', 401);
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(buildUrl(baseUrl, path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError('TIMEOUT', 'O servidor demorou para responder. Tente novamente.');
      }
      throw new ApiError('NETWORK', 'Sem conexão com o servidor. Verifique sua internet.');
    } finally {
      clearTimeout(timer);
    }
  }

  async function toError(response: Response): Promise<ApiError> {
    const parsed = ApiErrorBodySchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      return new ApiError(code, message, response.status, details);
    }
    return new ApiError('INTERNAL', 'Algo deu errado. Tente novamente.', response.status);
  }

  return {
    async request<T = void>(method: string, path: string, options: RequestOptions<T> = {}): Promise<T> {
      let response = await send(method, path, options, false);
      if (response.status === 401 && options.auth !== false) {
        response = await send(method, path, options, true);
      }
      if (!response.ok) throw await toError(response);

      if (response.status === 204) return undefined as T;
      const json: unknown = await response.json().catch(() => undefined);
      if (!options.schema) return undefined as T;
      const parsed = options.schema.safeParse(json);
      if (!parsed.success) throw new ApiError('INTERNAL', 'Resposta inesperada do servidor.', response.status);
      return parsed.data;
    },
  };
}
