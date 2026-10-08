import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTask,
  deleteTask,
  listTasks,
  TaskApiError,
  updateTask,
} from '../src/features/tasks/tasks.api';
import { jsonResponse, tasks } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('Cliente de escritura de tareas', () => {
  const input = {
    title: 'Revisar alertas del servidor',
    description: null,
    responsible: 'Ana Pérez',
    status: 'PENDIENTE' as const,
  };

  it.each(['POST', 'PUT'] as const)(
    'envía los cuatro campos como JSON mediante %s',
    async (method) => {
      fetchMock.mockResolvedValueOnce(jsonResponse(tasks[0], method === 'POST' ? 201 : 200));
      const result = method === 'POST' ? await createTask(input) : await updateTask(3, input);
      expect(result).toEqual(tasks[0]);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:3000/api/tasks${method === 'PUT' ? '/3' : ''}`,
        {
          method,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
    },
  );

  it('conserva los mensajes por campo y el estado HTTP de la API', async () => {
    const fields = { title: ['El título es obligatorio.'] };
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: 'VALIDATION_ERROR', message: 'Revisa los campos enviados.', fields } },
        400,
      ),
    );
    try {
      await createTask(input);
      expect.fail('La solicitud debía fallar.');
    } catch (error) {
      expect(error).toBeInstanceOf(TaskApiError);
      expect(error).toMatchObject({ status: 400, fields, message: 'Revisa los campos enviados.' });
    }
  });

  it('rechaza un guardado con una respuesta incompatible y pide consultar antes de reintentar', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 3 }, 201));
    await expect(createTask(input)).rejects.toThrow(
      'Actualiza el listado antes de volver a intentar.',
    );
  });

  it('acepta 204 al eliminar sin intentar leer JSON', async () => {
    const response = new Response(null, { status: 204 });
    const readJson = vi.spyOn(response, 'json');
    fetchMock.mockResolvedValueOnce(response);
    await expect(deleteTask(3)).resolves.toBeUndefined();
    expect(readJson).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3000/api/tasks/3', {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
  });

  it('informa cuando se intenta eliminar una tarea inexistente', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'TASK_NOT_FOUND', message: 'La tarea no existe.' } }, 404),
    );
    await expect(deleteTask(3)).rejects.toMatchObject({
      status: 404,
      message: 'La tarea no existe.',
    });
  });

  it('no confirma eliminación cuando la respuesta no es 204', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ deleted: true }));
    await expect(deleteTask(3)).rejects.toThrow('No pudimos confirmar la eliminación.');
  });
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
