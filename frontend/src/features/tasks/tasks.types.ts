import type { z } from 'zod';
import type { taskFormSchema, taskSchema, taskStatusSchema } from './tasks.schema';

export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskFormValues = z.input<typeof taskFormSchema>;
export type TaskInput = z.output<typeof taskFormSchema>;

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  COMPLETADO: 'Completado',
};
