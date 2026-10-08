import { z } from 'zod';

export const taskStatusSchema = z.enum(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO']);

export const taskSchema = z.object({
  id: z.number().int().positive().max(2147483647),
  title: z.string().trim().min(1).max(150),
  description: z.string().max(2000).nullable(),
  responsible: z.string().trim().min(1).max(100),
  status: taskStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const taskListSchema = z.array(taskSchema);

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio.')
    .max(150, 'El título no puede superar los 150 caracteres.'),
  description: z
    .string()
    .trim()
    .max(2000, 'La descripción no puede superar los 2.000 caracteres.')
    .transform((value) => value || null),
  responsible: z
    .string()
    .trim()
    .min(1, 'El responsable es obligatorio.')
    .max(100, 'El responsable no puede superar los 100 caracteres.'),
  status: z.enum(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO'], {
    error: 'El estado es obligatorio y debe ser válido.',
  }),
});
