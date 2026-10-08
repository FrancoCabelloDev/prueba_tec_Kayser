import { Router } from 'express';
import { validateBody } from '../../middlewares/validate-body.js';
import { createTask, deleteTask, listTasks, updateTask } from './task.controller.js';
import { validateTaskId } from './task.middleware.js';
import { createTaskSchema, updateTaskSchema } from './task.schema.js';

export const taskRouter = Router();

taskRouter.get('/', listTasks);
taskRouter.post('/', validateBody(createTaskSchema), createTask);
taskRouter.put('/:id', validateTaskId, validateBody(updateTaskSchema), updateTask);
taskRouter.delete('/:id', validateTaskId, deleteTask);
