import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { deferredResponse, jsonResponse, tasks } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('Consulta de tareas', () => {
  it('anuncia la carga y evita actualizar mientras la consulta está pendiente', async () => {
    const request = deferredResponse();
    fetchMock.mockReturnValueOnce(request.promise);
    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando tareas…');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled();
    await act(async () => {
      request.resolve(jsonResponse(tasks));
    });
    expect(await screen.findByRole('list', { name: 'Tareas registradas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
  });

  it('muestra los cuatro campos, los tres estados y conserva el orden recibido', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks));
    render(<App />);
    const list = await screen.findByRole('list', { name: 'Tareas registradas' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByRole('heading')).toHaveTextContent(tasks[0]!.title);
    expect(within(cards[0]!).getByText('Ana Pérez · TI-001')).toBeInTheDocument();
    expect(within(cards[0]!).getByText(/Comprobar los servicios/).textContent).toBe(
      tasks[0]!.description,
    );
    expect(within(cards[0]!).getByText('Pendiente')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('En Proceso')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('Sin descripción')).toBeInTheDocument();
    expect(within(cards[2]!).getByText('Completado')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('3 tareas');
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toBeEnabled();
    expect(
      within(cards[0]!).getByRole('button', { name: `Editar tarea: ${tasks[0]!.title}` }),
    ).toBeEnabled();
    expect(
      within(cards[0]!).getByRole('button', { name: `Eliminar tarea: ${tasks[0]!.title}` }),
    ).toBeEnabled();
  });

  it('explica la lista vacía y ofrece crear una tarea', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'No hay tareas registradas' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 tareas');
    expect(screen.getByRole('button', { name: 'Crear primera tarea' })).toBeEnabled();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('recupera un error de conexión al pulsar Reintentar', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(tasks));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor.',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('list')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('anuncia un error HTTP con el mensaje público de la API', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: 'INTERNAL_ERROR', message: 'No pudimos procesar la solicitud.' } },
        500,
      ),
    );
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos procesar la solicitud.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
  });

  it('actualiza los datos y vuelve a mostrar la carga durante la nueva consulta', async () => {
    const user = userEvent.setup();
    const nextRequest = deferredResponse();
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks)).mockReturnValueOnce(nextRequest.promise);
    render(<App />);
    await screen.findByRole('list');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tareas…');
    await act(async () => {
      nextRequest.resolve(jsonResponse([tasks[2]]));
    });
    expect(await screen.findByRole('heading', { name: 'Verificar respaldo' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 tarea');
    expect(screen.queryByRole('heading', { name: tasks[0]!.title })).not.toBeInTheDocument();
  });

  it('rechaza datos incompatibles sin romper la pantalla', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ ...tasks[0], status: 'OTRO' }]));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Los datos recibidos no tienen el formato esperado.',
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('cancela la solicitud al desmontar la pantalla', () => {
    fetchMock.mockReturnValueOnce(deferredResponse().promise);
    const { unmount } = render(<App />);
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('ignora una respuesta antigua cancelada por StrictMode', async () => {
    const firstRequest = deferredResponse();
    const secondRequest = deferredResponse();
    fetchMock.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise);
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await act(async () => {
      secondRequest.resolve(jsonResponse([tasks[2]]));
    });
    await screen.findByRole('heading', { name: 'Verificar respaldo' });
    await act(async () => {
      firstRequest.resolve(jsonResponse(tasks));
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 tarea'));
    expect(screen.queryByRole('heading', { name: tasks[0]!.title })).not.toBeInTheDocument();
  });
});
