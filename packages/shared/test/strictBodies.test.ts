import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';

import * as shared from '../src';

// A request body schema that ignores unknown keys would let a client smuggle fields past validation.
// ApiErrorBodySchema is a response shape, not a request body.
const bodySchemas = Object.entries(shared).filter(
  ([name]) => name.endsWith('BodySchema') && name !== 'ApiErrorBodySchema',
) as [string, ZodType][];

describe('request body schemas', () => {
  it('finds them all', () => {
    expect(bodySchemas.length).toBeGreaterThanOrEqual(15);
  });

  it.each(bodySchemas)('%s rejects unknown keys', (_name, schema) => {
    const result = schema.safeParse({ __unexpected__: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });
});
