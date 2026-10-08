import { z } from 'zod';
import { env } from '../../config/env';
import { taskListSchema, taskSchema } from './tasks.schema';
import type { Task, TaskInput } from './tasks.types';

const tasksUrl = `${env.VITE_API_URL.replace(/\/+$/, '')}/tasks`;
const errorResponseSchema = z.object({
  error: z.object({
    message: z.string().trim().min(1),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export class TaskApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'TaskApiError';
  }
}

async function request(url: string, options: RequestInit, fallback: string): Promise<unknown> {
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
    throw new TaskApiError(
      result.success ? result.data.error.message : fallback,
      response.status,
      result.success ? result.data.error.fields : undefined,
    );
  }
  return body;
}

export async function listTasks(signal: AbortSignal): Promise<Task[]> {
  const body = await request(
    tasksUrl,
    { headers: { Accept: 'application/json' }, signal },
    'No pudimos consultar las tareas. Vuelve a intentar.',
  );
  const result = taskListSchema.safeParse(body);
  if (!result.success)
    throw new Error('Los datos recibidos no tienen el formato esperado. Vuelve a intentar.');
  return result.data;
}

async function saveTask(url: string, method: 'POST' | 'PUT', input: TaskInput): Promise<Task> {
  const body = await request(
    url,
    {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No pudimos guardar la tarea. Vuelve a intentar.',
  );
  const result = taskSchema.safeParse(body);
  if (!result.success)
    throw new Error(
      'No pudimos validar la respuesta del guardado. Actualiza el listado antes de volver a intentar.',
    );
  return result.data;
}

export function createTask(input: TaskInput): Promise<Task> {
  return saveTask(tasksUrl, 'POST', input);
}

export function updateTask(id: number, input: TaskInput): Promise<Task> {
  return saveTask(`${tasksUrl}/${id}`, 'PUT', input);
}

export async function deleteTask(id: number): Promise<void> {
  const body = await request(
    `${tasksUrl}/${id}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
    'No pudimos eliminar la tarea. Vuelve a intentar.',
  );
  if (body !== undefined)
    throw new Error(
      'No pudimos confirmar la eliminación. Actualiza el listado antes de volver a intentar.',
    );
}
