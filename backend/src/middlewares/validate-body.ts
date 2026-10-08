import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError, type ValidationFields } from '../errors/api-error.js';

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const fields: ValidationFields = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? 'body');
        (fields[field] ??= []).push(issue.message);
      }
      next(new ApiError(400, 'VALIDATION_ERROR', 'Revisa los campos enviados.', fields));
      return;
    }

    request.body = result.data;
    next();
  };
}
