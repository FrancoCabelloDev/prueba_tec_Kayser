import type { Task } from '../src/features/tasks/tasks.types';

export const members = [
  { id: 1, code: 'TI-001', name: 'Ana Pérez', isActive: true },
  { id: 2, code: 'TI-002', name: 'Luis Torres', isActive: true },
  { id: 3, code: 'TI-003', name: 'María López', isActive: true },
  { id: 4, code: 'TI-004', name: 'Elena Díaz', isActive: true },
];

export const tasks: Task[] = [
  {
    id: 3,
    title: 'Revisar alertas del servidor',
    description: 'Comprobar los servicios.\nRegistrar el resultado.',
    responsibleId: 1,
    responsible: members[0]!,
    status: 'PENDIENTE',
    createdAt: '2026-10-08T12:00:00.000Z',
    updatedAt: '2026-10-08T12:00:00.000Z',
  },
  {
    id: 2,
    title: 'Actualizar equipos',
    description: null,
    responsibleId: 2,
    responsible: members[1]!,
    status: 'EN_PROCESO',
    createdAt: '2026-10-08T11:00:00.000Z',
    updatedAt: '2026-10-08T11:00:00.000Z',
  },
  {
    id: 1,
    title: 'Verificar respaldo',
    description: 'Respaldo verificado.',
    responsibleId: 3,
    responsible: members[2]!,
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
