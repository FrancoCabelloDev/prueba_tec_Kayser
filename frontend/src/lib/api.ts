import { z } from 'zod';

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
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error(
      'No pudimos conectar con el servidor. Comprueba la conexión y vuelve a intentar.',
      { cause: error },
    );
  }

  if (response.status === 204 && options.method === 'DELETE') return undefined;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      'El servidor devolvió una respuesta que no podemos mostrar. Vuelve a intentar.',
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
}
