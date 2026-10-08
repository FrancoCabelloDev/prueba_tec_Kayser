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
