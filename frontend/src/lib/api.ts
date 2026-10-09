import { z } from 'zod';

export const REQUEST_TIMEOUT_MS = 15_000;

export class RequestTimeoutError extends Error {
  constructor(method = 'GET') {
    super(
      ['GET', 'HEAD'].includes(method.toUpperCase())
        ? 'El servidor tardó demasiado en responder. Puedes volver a consultar.'
        : 'No pudimos confirmar la operación porque el servidor tardó demasiado en responder. Actualiza el listado para comprobar el resultado antes de volver a intentarlo.',
    );
    this.name = 'RequestTimeoutError';
  }
}

const errorResponseSchema = z.object({
  error: z.object({
    message: z.string().trim().min(1),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function requestJson(
  url: string,
  options: RequestInit,
  fallback: string,
): Promise<unknown> {
  const controller = new AbortController();
  const callerSignal = options.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  // El plazo incluye la recepción del cuerpo, no solo las cabeceras HTTP.
  const timeout = setTimeout(
    () => controller.abort(new RequestTimeoutError(options.method)),
    REQUEST_TIMEOUT_MS,
  );

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error(
        'No pudimos conectar con el servidor. Comprueba la conexión y vuelve a intentar.',
        { cause: error },
      );
    }

    if (response.status === 204 && options.method === 'DELETE') return undefined;

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error(
        'El servidor devolvió una respuesta que no podemos mostrar. Vuelve a intentar.',
        { cause: error },
      );
    }

    if (!response.ok) {
      const result = errorResponseSchema.safeParse(body);
      throw new ApiError(
        result.success ? result.data.error.message : fallback,
        response.status,
        result.success ? result.data.error.fields : undefined,
      );
    }
    return body;
  } catch (error) {
    if (controller.signal.reason instanceof RequestTimeoutError) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
