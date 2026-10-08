import type { RequestHandler } from 'express';
import { ApiError } from '../errors/api-error.js';

export const routeNotFound: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', 'La ruta solicitada no existe.'));
};
