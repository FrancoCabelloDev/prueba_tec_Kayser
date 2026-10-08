import { requestJson } from '../../lib/api';
export { ApiError as TaskApiError } from '../../lib/api';
import { env } from '../../config/env';
import { taskListSchema, taskSchema } from './tasks.schema';
import type { Task, TaskInput } from './tasks.types';

const tasksUrl = `${env.VITE_API_URL.replace(/\/+$/, '')}/tasks`;
export async function listTasks(signal: AbortSignal): Promise<Task[]> {
  const body = await requestJson(
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
  const body = await requestJson(
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
  const body = await requestJson(
    `${tasksUrl}/${id}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
    'No pudimos eliminar la tarea. Vuelve a intentar.',
  );
  if (body !== undefined)
    throw new Error(
      'No pudimos confirmar la eliminación. Actualiza el listado antes de volver a intentar.',
    );
}
