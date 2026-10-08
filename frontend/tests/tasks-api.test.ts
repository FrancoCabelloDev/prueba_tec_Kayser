import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listTasks } from '../src/features/tasks/tasks.api';
import { jsonResponse, tasks } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('Cliente de consulta de tareas', () => {
  it('consulta la URL configurada, pide JSON y propaga la señal de cancelación', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks));
    const controller = new AbortController();
    await expect(listTasks(controller.signal)).resolves.toEqual(tasks);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3000/api/tasks', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  });

  it('no muestra HTML cuando el servidor devuelve una respuesta no JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Error interno</html>', { status: 502 }));
    await expect(listTasks(new AbortController().signal)).rejects.toThrow(
      'El servidor devolvió una respuesta que no podemos mostrar.',
    );
  });

  it('usa un mensaje comprensible si el error HTTP no sigue el contrato', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'stack interno' }, 503));
    await expect(listTasks(new AbortController().signal)).rejects.toThrow(
      'No pudimos consultar las tareas.',
    );
  });

  it.each([
    ['un objeto en lugar de una lista', { tasks }],
    ['un identificador inválido', [{ ...tasks[0], id: 0 }]],
    ['un campo obligatorio ausente', [{ id: 1, title: 'Incompleta' }]],
    ['una fecha inválida', [{ ...tasks[0], createdAt: 'ayer' }]],
  ])('rechaza %s', async (_case, body) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
    await expect(listTasks(new AbortController().signal)).rejects.toThrow(
      'Los datos recibidos no tienen el formato esperado.',
    );
  });

  it('conserva el error de cancelación para que el hook lo ignore', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = new DOMException('Solicitud cancelada', 'AbortError');
    fetchMock.mockRejectedValueOnce(error);
    await expect(listTasks(controller.signal)).rejects.toBe(error);
  });
});
