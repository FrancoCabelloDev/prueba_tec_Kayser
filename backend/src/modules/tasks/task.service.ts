import { taskRepository } from './task.repository.js';
import type { CreateTaskInput } from './task.schema.js';

export const taskService = {
  list() {
    return taskRepository.list();
  },
  create(input: CreateTaskInput) {
    return taskRepository.create({
      title: input.title,
      description: input.description || null,
      responsible: input.responsible,
      status: input.status,
    });
  },
};
