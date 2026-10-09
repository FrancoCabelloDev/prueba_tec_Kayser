import type { Task, TaskStatus } from './tasks.types';

export type TaskFilterValues = Readonly<{
  status: TaskStatus | null;
  responsibleId: number | null;
}>;

export const defaultTaskFilters: TaskFilterValues = { status: null, responsibleId: null };

export function filterTasks(tasks: readonly Task[], filters: TaskFilterValues): Task[] {
  return tasks.filter(
    (task) =>
      (filters.status === null || task.status === filters.status) &&
      (filters.responsibleId === null || task.responsibleId === filters.responsibleId),
  );
}

export function getTaskResponsibles(tasks: readonly Task[]): Task['responsible'][] {
  const members = new Map(tasks.map((task) => [task.responsibleId, task.responsible]));
  return [...members.values()].sort(
    (first, second) =>
      first.name.localeCompare(second.name, 'es') ||
      first.code.localeCompare(second.code, 'es') ||
      first.id - second.id,
  );
}
