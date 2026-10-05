import { HealthResponseSchema } from '@aurelia/shared';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient } from '@/lib/api/client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>, getToken: (forceRefresh?: boolean) => Promise<string | null> = vi.fn(async (_forceRefresh?: boolean): Promise<string | null> => 'token-1')) {
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init ?? {}));
  const client = createApiClient({ baseUrl: 'http://api.test/api/v1', getToken, timeoutMs: 50, fetchImpl: fetchImpl as unknown as typeof fetch });
  return { client, fetchImpl, getToken };
}

const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

describe('api client', () => {
  it('sends the ID token and parses the response with the schema', async () => {
    const { client, fetchImpl } = setup(() => json({ status: 'ok' }));
    await expect(client.request('GET', '/health', { schema: HealthResponseSchema })).resolves.toEqual({ status: 'ok' });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/health');
    expect(headersOf(init).Authorization).toBe('Bearer token-1');
  });

  it('sends JSON bodies and skips undefined query values', async () => {
    const { client, fetchImpl } = setup(() => new Response(null, { status: 204 }));
    await client.request('POST', '/x', { body: { a: 1 }, query: { date: undefined, limit: 5, cursor: 'a b' } });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/x?limit=5&cursor=a%20b');
    expect(init.body).toBe('{"a":1}');
    expect(headersOf(init)['Content-Type']).toBe('application/json');
  });

  it('does not attach a token to public routes', async () => {
    const { client, fetchImpl, getToken } = setup(() => json({ status: 'ok' }));
    await client.request('GET', '/health', { schema: HealthResponseSchema, auth: false });
    expect(getToken).not.toHaveBeenCalled();
    expect(headersOf((fetchImpl.mock.calls[0] as [string, RequestInit])[1])).not.toHaveProperty('Authorization');
  });

  it('retries once with a freshly minted token after a 401', async () => {
    let calls = 0;
    const getToken = vi.fn(async (forceRefresh?: boolean): Promise<string | null> => (forceRefresh ? 'fresh' : 'stale'));
    const { client, fetchImpl } = setup(
      () => (++calls === 1 ? json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401) : json({ status: 'ok' })),
      getToken,
    );
    await expect(client.request('GET', '/me', { schema: HealthResponseSchema })).resolves.toEqual({ status: 'ok' });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(headersOf((fetchImpl.mock.calls[1] as [string, RequestInit])[1]).Authorization).toBe('Bearer fresh');
  });

  it('gives up after the retry and surfaces the API error', async () => {
    const { client, fetchImpl } = setup(() => json({ error: { code: 'UNAUTHENTICATED', message: 'Token inválido.' } }, 401));
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry public routes on 401', async () => {
    const { client, fetchImpl } = setup(() => json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401));
    await expect(client.request('POST', '/auth/pair', { auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('turns an API error body into an ApiError with code, message and details', async () => {
    const { client } = setup(() => json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: { field: 'name' } } }, 400));
    const error = await client.request('POST', '/elders', { body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Dados inválidos.', status: 400, details: { field: 'name' } });
  });

  it('maps an unreadable error response to INTERNAL', async () => {
    const { client } = setup(() => new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'INTERNAL', status: 502 });
  });

  it('rejects a response that does not match the schema', async () => {
    const { client } = setup(() => json({ status: 'nope' }));
    await expect(client.request('GET', '/health', { schema: HealthResponseSchema })).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('reports NETWORK when fetch fails', async () => {
    const { client } = setup(() => {
      throw new TypeError('Network request failed');
    });
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'NETWORK', status: null });
  });

  it('reports TIMEOUT when the server takes too long', async () => {
    const { client } = setup(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('fails as UNAUTHENTICATED, without calling the API, when there is no session', async () => {
    const { client, fetchImpl } = setup(() => json({}), vi.fn(async (): Promise<string | null> => null));
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
