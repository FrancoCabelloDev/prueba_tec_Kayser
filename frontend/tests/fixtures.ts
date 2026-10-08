import type { Task } from '../src/features/tasks/tasks.types';

export const tasks: Task[] = [
  {
    id: 3,
    title: 'Revisar alertas del servidor',
    description: 'Comprobar los servicios.\nRegistrar el resultado.',
    responsible: 'Ana Pérez',
    status: 'PENDIENTE',
    createdAt: '2026-10-08T12:00:00.000Z',
    updatedAt: '2026-10-08T12:00:00.000Z',
  },
  {
    id: 2,
    title: 'Actualizar equipos',
    description: null,
    responsible: 'Luis Torres',
    status: 'EN_PROCESO',
    createdAt: '2026-10-08T11:00:00.000Z',
    updatedAt: '2026-10-08T11:00:00.000Z',
  },
  {
    id: 1,
    title: 'Verificar respaldo',
    description: 'Respaldo verificado.',
    responsible: 'María López',
    status: 'COMPLETADO',
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
  },
];

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}
