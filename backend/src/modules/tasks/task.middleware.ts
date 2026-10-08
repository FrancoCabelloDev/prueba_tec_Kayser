import type { RequestHandler } from 'express';
import { ApiError } from '../../errors/api-error.js';
import { taskIdSchema } from './task.schema.js';

export type TaskLocals = { taskId: number };

export const validateTaskId: RequestHandler = (request, response, next) => {
  const result = taskIdSchema.safeParse(request.params.id);
  if (!result.success) {
    next(
      new ApiError(400, 'VALIDATION_ERROR', 'Revisa los campos enviados.', {
        id: result.error.issues.map((issue) => issue.message),
      }),
    );
    return;
  }

  response.locals.taskId = result.data;
  next();
};
