import type { z } from 'zod';
import type { taskSchema, taskStatusSchema } from './tasks.schema';

export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  COMPLETADO: 'Completado',
};
