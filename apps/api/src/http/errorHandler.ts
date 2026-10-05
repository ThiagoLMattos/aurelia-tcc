import type { ApiErrorBody } from '@aurelia/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError, notFound } from './errors';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound('Rota não encontrada.'));
};

function bodyParserError(error: unknown): AppError | null {
  if (typeof error !== 'object' || error === null) return null;
  const type = (error as { type?: unknown }).type;
  if (type === 'entity.parse.failed') return new AppError('VALIDATION_ERROR', 'JSON inválido.');
  if (type === 'entity.too.large') return new AppError('VALIDATION_ERROR', 'Corpo da requisição muito grande.');
  return null;
}

export function zodDetails(error: ZodError): Record<string, unknown> {
  return { issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) };
}

/** Maps every error to the spec §5 shape. Unknown errors are logged and never leaked. */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  let appError: AppError | null = null;
  if (error instanceof AppError) appError = error;
  else if (error instanceof ZodError) appError = new AppError('VALIDATION_ERROR', 'Dados inválidos.', zodDetails(error));
  else appError = bodyParserError(error);

  if (!appError) {
    req.log.error({ err: error }, 'unhandled error');
    appError = new AppError('INTERNAL', 'Erro interno. Tente novamente em instantes.');
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  };
  res.status(appError.status).json(body);
};
