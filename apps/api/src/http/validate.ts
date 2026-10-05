import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from './errors';
import { zodDetails } from './errorHandler';

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Validates body/params/query with shared zod schemas and replaces them with the parsed value,
 * so handlers only ever see typed, stripped-down input.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(new AppError('VALIDATION_ERROR', 'Dados inválidos.', { ...zodDetails(result.error), in: key }));
      }
      // Express 5 exposes req.query as a getter, so redefine instead of assigning.
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true });
    }
    next();
  };
}
