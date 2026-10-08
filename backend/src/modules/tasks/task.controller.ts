import type { Request, Response } from 'express';
import type { TaskLocals } from './task.middleware.js';
import type { CreateTaskInput, UpdateTaskInput } from './task.schema.js';
import { taskService } from './task.service.js';

export async function listTasks(_request: Request, response: Response) {
  const tasks = await taskService.list();
  response.status(200).json(tasks);
}

export async function createTask(
  request: Request<Record<string, never>, unknown, CreateTaskInput>,
  response: Response,
) {
  const task = await taskService.create(request.body);
  response.status(201).json(task);
}

export async function updateTask(
  request: Request<{ id: string }, unknown, UpdateTaskInput>,
  response: Response<unknown, TaskLocals>,
) {
  const task = await taskService.update(response.locals.taskId, request.body);
  response.status(200).json(task);
}

export async function deleteTask(_request: Request, response: Response<unknown, TaskLocals>) {
  await taskService.delete(response.locals.taskId);
  response.status(204).end();
}
