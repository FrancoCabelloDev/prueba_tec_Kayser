import { z } from 'zod';
import { TaskStatus } from '../../generated/prisma/enums.js';

export const createTaskSchema = z.strictObject(
  {
    title: z
      .string({
        error: (issue) =>
          issue.input === undefined ? 'El título es obligatorio.' : 'El título debe ser un texto.',
      })
      .trim()
      .min(1, 'El título es obligatorio.')
      .max(150, 'El título no puede superar los 150 caracteres.'),
    description: z
      .string({ error: 'La descripción debe ser un texto.' })
      .trim()
      .max(2000, 'La descripción no puede superar los 2.000 caracteres.')
      .nullable()
      .optional(),
    responsible: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? 'El responsable es obligatorio.'
            : 'El responsable debe ser un texto.',
      })
      .trim()
      .min(1, 'El responsable es obligatorio.')
      .max(100, 'El responsable no puede superar los 100 caracteres.'),
    status: z.enum(TaskStatus, {
      error: (issue) =>
        issue.input === undefined
          ? 'El estado es obligatorio.'
          : 'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO.',
    }),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? 'Solo se permiten los campos title, description, responsible y status.'
        : 'El cuerpo de la solicitud debe ser un objeto JSON.',
  },
);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.extend({
  description: createTaskSchema.shape.description.nonoptional({
    error: 'Envía la descripción como texto o null al editar la tarea.',
  }),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskIdSchema = z
  .string({ error: 'El identificador de la tarea es obligatorio.' })
  .refine((value) => value === value.trim() && /^[1-9]\d*$/.test(value), {
    message: 'El identificador debe ser un entero positivo sin ceros iniciales ni espacios.',
  })
  .transform(Number)
  .refine((value) => Number.isSafeInteger(value) && value <= 2147483647, {
    message: 'El identificador no puede superar 2147483647.',
  });
