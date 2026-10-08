import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../errors/api-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  let apiError: ApiError;
  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof URIError && 'status' in error && error.status === 400) {
    apiError = new ApiError(400, 'INVALID_PATH', 'La ruta contiene una codificación inválida.');
  } else if (typeof error === 'object' && error !== null && 'type' in error) {
    switch (error.type) {
      case 'entity.parse.failed':
        apiError = new ApiError(
          400,
          'INVALID_JSON',
          'El cuerpo de la solicitud debe ser JSON válido.',
        );
        break;
      case 'entity.too.large':
        apiError = new ApiError(
          413,
          'PAYLOAD_TOO_LARGE',
          'La solicitud supera el límite de 16 KB.',
        );
        break;
      case 'encoding.unsupported':
      case 'charset.unsupported':
        apiError = new ApiError(
          415,
          'UNSUPPORTED_ENCODING',
          'La codificación de la solicitud no está permitida.',
        );
        break;
      default:
        console.error('Error inesperado al procesar la solicitud.', error);
        apiError = new ApiError(500, 'INTERNAL_ERROR', 'No se pudo procesar la solicitud.');
    }
  } else {
    console.error('Error inesperado al procesar la solicitud.', error);
    apiError = new ApiError(500, 'INTERNAL_ERROR', 'No se pudo procesar la solicitud.');
  }

  response.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.fields ? { fields: apiError.fields } : {}),
    },
  });
};
