import { ApiError } from '../../errors/api-error.js';
import { taskRepository } from './task.repository.js';
import type { CreateTaskInput, UpdateTaskInput } from './task.schema.js';

function editableTaskData(input: CreateTaskInput) {
  return {
    title: input.title,
    description: input.description || null,
    responsible: input.responsible,
    status: input.status,
  };
}

export const taskService = {
  list() {
    return taskRepository.list();
  },
  create(input: CreateTaskInput) {
    return taskRepository.create(editableTaskData(input));
  },
  async update(id: number, input: UpdateTaskInput) {
    const task = await taskRepository.update(id, editableTaskData(input));
    if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'La tarea solicitada no existe.');
    return task;
  },
  async delete(id: number) {
    const task = await taskRepository.delete(id);
    if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'La tarea solicitada no existe.');
  },
};
