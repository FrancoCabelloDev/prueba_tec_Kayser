import type { Request, Response } from 'express';
import type { CreateTaskInput } from './task.schema.js';
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
