import { ERROR_HTTP_STATUS, type ErrorCode } from '@aurelia/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_HTTP_STATUS[code];
    this.details = details;
  }
}

export const validationError = (message = 'Dados inválidos.', details?: Record<string, unknown>) =>
  new AppError('VALIDATION_ERROR', message, details);
export const unauthenticated = (message = 'Faça login para continuar.') => new AppError('UNAUTHENTICATED', message);
export const forbidden = (message = 'Você não tem permissão para isso.') => new AppError('FORBIDDEN', message);
export const notFound = (message = 'Recurso não encontrado.') => new AppError('NOT_FOUND', message);
export const conflict = (message: string) => new AppError('CONFLICT', message);
export const rateLimited = (message = 'Muitas tentativas. Tente novamente mais tarde.') =>
  new AppError('RATE_LIMITED', message);
