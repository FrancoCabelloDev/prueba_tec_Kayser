import { z } from 'zod';
import { env } from '../../config/env';
import { taskListSchema } from './tasks.schema';
import type { Task } from './tasks.types';

const tasksUrl = `${env.VITE_API_URL.replace(/\/+$/, '')}/tasks`;
const errorResponseSchema = z.object({
  error: z.object({ message: z.string().trim().min(1) }),
});

export async function listTasks(signal: AbortSignal): Promise<Task[]> {
  let response: Response;

  try {
    response = await fetch(tasksUrl, { headers: { Accept: 'application/json' }, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      'No pudimos conectar con el servidor. Comprueba la conexión y vuelve a intentar.',
      { cause: error },
    );
  }

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
    throw new Error(
      result.success
        ? result.data.error.message
        : 'No pudimos consultar las tareas. Vuelve a intentar.',
    );
  }

  const result = taskListSchema.safeParse(body);
  if (!result.success) {
    throw new Error('Los datos recibidos no tienen el formato esperado. Vuelve a intentar.');
  }

  return result.data;
}
