import { ApiError } from '../../errors/api-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { AssignmentValidator } from './task.repository.js';
import { taskRepository } from './task.repository.js';
import type { CreateTaskInput, UpdateTaskInput } from './task.schema.js';

function editableTaskData(input: CreateTaskInput) {
  return {
    title: input.title,
    description: input.description || null,
    responsibleId: input.responsibleId,
    status: input.status,
  };
}

const validateAssignment: AssignmentValidator = (member, currentResponsibleId) => {
  if (!member || (!member.isActive && member.id !== currentResponsibleId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Revisa los campos enviados.', {
      responsibleId: [
        member
          ? 'Selecciona un integrante activo del equipo.'
          : 'El responsable seleccionado no existe.',
      ],
    });
  }
};
function translateReferenceError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Revisa los campos enviados.', {
      responsibleId: ['El responsable seleccionado ya no está disponible.'],
    });
  }
  throw error;
}

export const taskService = {
  list() {
    return taskRepository.list();
  },
  async create(input: CreateTaskInput) {
    try {
      return await taskRepository.create(editableTaskData(input), validateAssignment);
    } catch (error) {
      translateReferenceError(error);
    }
  },
  async update(id: number, input: UpdateTaskInput) {
    try {
      const task = await taskRepository.update(id, editableTaskData(input), validateAssignment);
      if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'La tarea solicitada no existe.');
      return task;
    } catch (error) {
      translateReferenceError(error);
    }
  },
  async delete(id: number) {
    const task = await taskRepository.delete(id);
    if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'La tarea solicitada no existe.');
  },
};
