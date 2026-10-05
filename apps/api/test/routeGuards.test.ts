import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { bearer, buildApp, createScenario, expectApiError } from './helpers';

/**
 * Walks the real Express router (not a hand-kept list) and checks that nothing was mounted without its
 * guard: every /elders/:elderId/** route must refuse outsiders, and every route outside the public
 * allowlist must refuse anonymous callers. A route added later without its guard fails here.
 */

interface RouteLike {
  methods: Record<string, boolean>;
}
type Fn = (...args: unknown[]) => unknown;
interface RouterStatics {
  use: Fn;
  route: Fn;
}

const PREFIX = '/api/v1';
const PUBLIC_ROUTES = new Set([
  'GET /health',
  'POST /auth/signup',
  'POST /auth/pair',
  'POST /device/location',
  'POST /internal/jobs/run',
  'POST /internal/jobs/escalate',
]);

const parentOf = new Map<object, { parent: object; path: string }>();
const found: { owner: object; route: RouteLike; path: string }[] = [];

// Router mount paths are not kept on the finished router, so record them while the app is built.
const routerStatics = express.Router.prototype as unknown as RouterStatics;
const originalUse = routerStatics.use;
const originalRoute = routerStatics.route;

function joinPaths(...parts: string[]): string {
  const joined = parts.join('/').replace(/\/+/g, '/').replace(/\/$/, '');
  return joined === '' ? '/' : joined;
}

function pathOf(route: object, owner: object, own: string): string {
  const parts = [own];
  for (let node: object = owner, link = parentOf.get(node); link; link = parentOf.get(node)) {
    parts.unshift(link.path);
    node = link.parent;
  }
  void route;
  return joinPaths(...parts);
}

let endpoints: { method: string; path: string }[] = [];

beforeAll(() => {
  routerStatics.use = function (this: object, ...args: unknown[]) {
    const [first, ...rest] = args;
    const path = typeof first === 'string' ? first : '/';
    for (const handler of (typeof first === 'string' ? rest : args).flat() as object[]) {
      if (Array.isArray((handler as { stack?: unknown }).stack)) parentOf.set(handler, { parent: this, path });
    }
    return originalUse.apply(this, args);
  };
  routerStatics.route = function (this: object, ...args: unknown[]) {
    const route = originalRoute.apply(this, args) as RouteLike;
    found.push({ owner: this, route, path: String(args[0]) });
    return route;
  };
  buildApp(); 
  routerStatics.use = originalUse;
  routerStatics.route = originalRoute;

  endpoints = found
    .map((entry) => ({ entry, path: pathOf(entry.route, entry.owner, entry.path) }))
    .filter(({ path }) => path.startsWith(PREFIX))
    .flatMap(({ entry, path }) =>
      Object.keys(entry.route.methods)
        .filter((method) => method !== '_all')
        .map((method) => ({ method: method.toUpperCase(), path: path.slice(PREFIX.length) })),
    );
});

afterAll(() => {
  routerStatics.use = originalUse;
  routerStatics.route = originalRoute;
});

const isElderScoped = (path: string) => path === '/elders/:elderId' || path.startsWith('/elders/:elderId/');

describe('route guards', () => {
  it('finds the whole API surface', () => {
    const elderScoped = endpoints.filter(({ path }) => isElderScoped(path));
    expect(elderScoped.length).toBeGreaterThanOrEqual(20);
    expect(endpoints.length).toBeGreaterThan(elderScoped.length);
    for (const route of PUBLIC_ROUTES) {
      expect(endpoints.map(({ method, path }) => `${method} ${path}`), route).toContain(route);
    }
  });

  it('refuses outsiders on every /elders/:elderId/** route', async () => {
    const app = buildApp();
    const { elderId, other, otherElderToken } = await createScenario();
    const targets = endpoints.filter(({ path }) => isElderScoped(path));

    for (const { method, path } of targets) {
      const url = `${PREFIX}${path.replace(':elderId', elderId).replace(/:\w+/g, 'x1')}`;
      const call = (token?: string) => {
        const req = request(app)[method.toLowerCase() as 'get'](url);
        if (token) req.set(bearer(token));
        return method === 'GET' ? req : req.send({});
      };
      const label = `${method} ${path}`;
      try {
        expectApiError(await call(), 401, 'UNAUTHENTICATED');
        expectApiError(await call(other.token), 403, 'FORBIDDEN');
        expectApiError(await call(otherElderToken), 403, 'FORBIDDEN');
      } catch (error) {
        throw new Error(`${label} is not guarded by requireElderAccess: ${(error as Error).message}`);
      }
    }
  });

  it('refuses anonymous callers everywhere except the public allowlist', async () => {
    const app = buildApp();
    const targets = endpoints.filter(({ method, path }) => !PUBLIC_ROUTES.has(`${method} ${path}`));
    expect(targets.length).toBeGreaterThan(20);

    for (const { method, path } of targets) {
      const url = `${PREFIX}${path.replace(/:\w+/g, 'x1')}`;
      const req = request(app)[method.toLowerCase() as 'get'](url);
      const response = await (method === 'GET' ? req : req.send({}));
      expect(response.status, `${method} ${path} must require authentication`).toBe(401);
    }
  });

  it('is documented in docs/api.md, and the document lists nothing that does not exist', () => {
    const doc = readFileSync(resolve(import.meta.dirname, '../../../docs/api.md'), 'utf8');
    const documented = new Set(
      [...doc.matchAll(/`((?:GET|POST|PATCH|PUT|DELETE) \/[^`?\s]*)[^`]*`/g)].map((match) => match[1] as string),
    );
    const real = new Set(endpoints.map(({ method, path }) => `${method} ${path}`));
    expect([...real].filter((route) => !documented.has(route)), 'routes missing from docs/api.md').toEqual([]);
    expect([...documented].filter((route) => !real.has(route)), 'documented routes that do not exist').toEqual([]);
  });
});
