import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listActiveTeamMembers } from '../src/features/team-members/team-members.api';
import { createTask, deleteTask, listTasks, updateTask } from '../src/features/tasks/tasks.api';
import { ApiError, REQUEST_TIMEOUT_MS, RequestTimeoutError, requestJson } from '../src/lib/api';
import { abortablePendingResponse, jsonResponse } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();
const input = {
  title: 'Revisar servidor',
  description: null,
  responsibleId: 1,
  status: 'PENDIENTE' as const,
};

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock
    .mockReset()
    .mockImplementation((_url, options) => abortablePendingResponse(options!.signal!));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('Tiempo máximo de las solicitudes HTTP', () => {
  it.each([
    ['crear', () => createTask(input)],
    ['editar', () => updateTask(1, input)],
    ['eliminar', () => deleteTask(1)],
  ] as const)(
    'interrumpe %s sin reintentos automáticos ni confirmaciones falsas',
    async (_name, operation) => {
      const assertion = expect(operation()).rejects.toMatchObject({
        name: 'RequestTimeoutError',
        message: expect.stringContaining('Actualiza el listado para comprobar el resultado'),
      });
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each([
    ['tareas', listTasks],
    ['integrantes', listActiveTeamMembers],
  ] as const)(
    'permite recuperar la consulta de %s cuando vence el plazo',
    async (_name, operation) => {
      const controller = new AbortController();
      const assertion = expect(operation(controller.signal)).rejects.toMatchObject({
        name: 'RequestTimeoutError',
        message: 'El servidor tardó demasiado en responder. Puedes volver a consultar.',
      });
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      await assertion;
      expect(controller.signal.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('mantiene el plazo al recibir cabeceras y lo aplica también al cuerpo', async () => {
    fetchMock.mockImplementationOnce((_url, options) => {
      const response = jsonResponse({});
      vi.spyOn(response, 'json').mockImplementation(() =>
        abortablePendingResponse(options!.signal!),
      );
      return new Promise((resolve) => setTimeout(() => resolve(response), 5_000));
    });
    const assertion = expect(
      requestJson('/tasks', { method: 'POST' }, 'Error'),
    ).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 5_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['connection', 'body'] as const)(
    'conserva la cancelación del componente durante %s',
    async (stage) => {
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
      const reason = new DOMException('Componente desmontado', 'AbortError');
      if (stage === 'body') {
        fetchMock.mockImplementationOnce((_url, options) => {
          const response = jsonResponse({});
          vi.spyOn(response, 'json').mockImplementation(() =>
            abortablePendingResponse(options!.signal!),
          );
          return Promise.resolve(response);
        });
      }
      const assertion = expect(
        requestJson('/tasks', { signal: controller.signal }, 'Error'),
      ).rejects.toBe(reason);
      await vi.advanceTimersByTimeAsync(0);
      controller.abort(reason);
      await assertion;
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.reason).toBe(reason);
      expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(['success', 'http', 'network', 'json', 'delete'] as const)(
    'libera el plazo y los listeners al finalizar con %s',
    async (outcome) => {
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
      if (outcome === 'network') fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      else if (outcome === 'json')
        fetchMock.mockResolvedValueOnce(new Response('<html>Error</html>'));
      else if (outcome === 'http')
        fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'Error público' } }, 400));
      else
        fetchMock.mockResolvedValueOnce(
          outcome === 'delete' ? new Response(null, { status: 204 }) : jsonResponse({ ok: true }),
        );
      const promise = requestJson(
        '/tasks',
        { signal: controller.signal, method: outcome === 'delete' ? 'DELETE' : 'GET' },
        'Error',
      );
      if (outcome === 'http') await expect(promise).rejects.toBeInstanceOf(ApiError);
      else if (outcome === 'network' || outcome === 'json')
        await expect(promise).rejects.toBeInstanceOf(Error);
      else await expect(promise).resolves.toEqual(outcome === 'delete' ? undefined : { ok: true });
      expect(vi.getTimerCount()).toBe(0);
      expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    },
  );
});
