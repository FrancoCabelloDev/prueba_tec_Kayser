import { Router } from 'express';
import { validateBody } from '../../middlewares/validate-body.js';
import { createTask, listTasks } from './task.controller.js';
import { createTaskSchema } from './task.schema.js';

export const taskRouter = Router();

taskRouter.get('/', listTasks);
taskRouter.post('/', validateBody(createTaskSchema), createTask);
