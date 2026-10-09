import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { taskStatusLabels, type TaskStatus } from '../src/features/tasks/tasks.types';
import { jsonResponse, members, tasks } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function statusFilter() {
  return screen.getByLabelText('Filtrar por estado');
}

function responsibleFilter() {
  return screen.getByLabelText('Filtrar por responsable');
}

function visibleTitles() {
  return within(screen.getByRole('list', { name: 'Tareas registradas' }))
    .getAllByRole('heading')
    .map((heading) => heading.textContent);
}

async function openList(data = tasks) {
  fetchMock.mockResolvedValueOnce(jsonResponse(data));
  render(<App />);
  await screen.findByRole('list', { name: 'Tareas registradas' });
}

describe('Filtros de estado y responsable', () => {
  it('inicia con todos los criterios y conserva el orden original sin consultas adicionales', async () => {
    await openList();
    expect(screen.getByRole('group', { name: 'Filtros de tareas' })).toBeInTheDocument();
    expect(statusFilter()).toHaveValue('');
    expect(responsibleFilter()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
    expect(visibleTitles()).toEqual(tasks.map((task) => task.title));
    expect(screen.getByRole('status')).toHaveTextContent('3 tareas');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO'] satisfies TaskStatus[])(
    'muestra únicamente las tareas en %s',
    async (status) => {
      const user = userEvent.setup();
      await openList();
      await user.selectOptions(statusFilter(), status);
      expect(visibleTitles()).toEqual(
        tasks.filter((task) => task.status === status).map((task) => task.title),
      );
      expect(statusFilter()).toHaveDisplayValue(taskStatusLabels[status]);
      expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1 de 3 tareas');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('combina ambos criterios y permite quitar cada uno por separado', async () => {
    const user = userEvent.setup();
    const sameResponsible = {
      ...tasks[1]!,
      id: 4,
      title: 'Segunda tarea de Ana',
      responsibleId: 1,
      responsible: members[0]!,
    };
    const sameStatus = {
      ...tasks[0]!,
      id: 5,
      title: 'Tarea pendiente de Luis',
      responsibleId: 2,
      responsible: members[1]!,
    };
    const data = [sameResponsible, ...tasks, sameStatus];
    await openList(data);
    await user.selectOptions(responsibleFilter(), '1');
    expect(visibleTitles()).toEqual([sameResponsible.title, tasks[0]!.title]);
    await user.selectOptions(statusFilter(), 'PENDIENTE');
    expect(visibleTitles()).toEqual([tasks[0]!.title]);
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1 de 5 tareas');
    await user.selectOptions(responsibleFilter(), '');
    expect(statusFilter()).toHaveValue('PENDIENTE');
    expect(visibleTitles()).toEqual([tasks[0]!.title, sameStatus.title]);
    await user.selectOptions(responsibleFilter(), '1');
    await user.selectOptions(statusFilter(), '');
    expect(responsibleFilter()).toHaveValue('1');
    expect(visibleTitles()).toEqual([sameResponsible.title, tasks[0]!.title]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('limpia ambos criterios y recupera todas las tareas en su orden original', async () => {
    const user = userEvent.setup();
    await openList();
    await user.selectOptions(statusFilter(), 'EN_PROCESO');
    await user.selectOptions(responsibleFilter(), '2');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(statusFilter()).toHaveValue('');
    expect(responsibleFilter()).toHaveValue('');
    expect(visibleTitles()).toEqual(tasks.map((task) => task.title));
    expect(screen.getByRole('status')).toHaveTextContent('3 tareas');
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('distingue la falta de coincidencias y mantiene las opciones de responsables de toda la lista', async () => {
    const user = userEvent.setup();
    await openList();
    await user.selectOptions(statusFilter(), 'PENDIENTE');
    expect(within(responsibleFilter()).getAllByRole('option')).toHaveLength(4);
    await user.selectOptions(responsibleFilter(), '2');
    expect(
      screen.getByRole('heading', { name: 'No hay tareas que coincidan con los filtros' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No hay tareas registradas' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear primera tarea' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 0 de 3 tareas');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(visibleTitles()).toEqual(tasks.map((task) => task.title));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('distingue homónimos por código, incluye inactivos y elimina opciones duplicadas por identificador', async () => {
    const user = userEvent.setup();
    const historical = {
      ...tasks[0]!,
      responsible: { ...members[0]!, name: 'Ana Pérez', isActive: false },
    };
    const homonym = { ...tasks[1]!, responsible: { ...members[1]!, name: 'Ana Pérez' } };
    const anotherHistorical = { ...historical, id: 4, title: 'Otra tarea histórica' };
    await openList([historical, homonym, anotherHistorical]);
    expect(within(responsibleFilter()).getAllByRole('option')).toHaveLength(3);
    expect(
      screen.getByRole('option', { name: 'Ana Pérez · TI-001 (inactivo)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana Pérez · TI-002' })).toBeInTheDocument();
    await user.selectOptions(responsibleFilter(), '1');
    expect(visibleTitles()).toEqual([historical.title, anotherHistorical.title]);
    await user.selectOptions(responsibleFilter(), '2');
    expect(visibleTitles()).toEqual([homonym.title]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('conserva los filtros al actualizar y calcula los resultados con las tareas recibidas', async () => {
    const user = userEvent.setup();
    await openList();
    const added = { ...tasks[0]!, id: 4, title: 'Nueva tarea pendiente' };
    fetchMock.mockResolvedValueOnce(jsonResponse([added, ...tasks]));
    await user.selectOptions(statusFilter(), 'PENDIENTE');
    await user.selectOptions(responsibleFilter(), '1');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await screen.findByText('Mostrando 2 de 4 tareas');
    expect(statusFilter()).toHaveValue('PENDIENTE');
    expect(responsibleFilter()).toHaveValue('1');
    expect(visibleTitles()).toEqual([added.title, tasks[0]!.title]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('conserva los criterios después de un error de actualización y del reintento', async () => {
    const user = userEvent.setup();
    await openList();
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(tasks));
    await user.selectOptions(statusFilter(), 'COMPLETADO');
    await user.selectOptions(responsibleFilter(), '3');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Mostrando 1 de 3 tareas');
    expect(statusFilter()).toHaveValue('COMPLETADO');
    expect(responsibleFilter()).toHaveValue('3');
    expect(visibleTitles()).toEqual([tasks[2]!.title]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('mantiene el mensaje de base vacía aunque haya un filtro de estado seleccionado', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<App />);
    await screen.findByRole('heading', { name: 'No hay tareas registradas' });
    await user.selectOptions(statusFilter(), 'PENDIENTE');
    expect(screen.getByRole('heading', { name: 'No hay tareas registradas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear primera tarea' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 0 de 0 tareas');
    expect(
      screen.queryByRole('heading', { name: 'No hay tareas que coincidan con los filtros' }),
    ).not.toBeInTheDocument();
  });
});

describe('Filtros durante las operaciones CRUD', () => {
  it('conserva los criterios al crear una tarea que no coincide y permite verla al limpiar', async () => {
    const user = userEvent.setup();
    await openList();
    const created = { ...tasks[0]!, id: 4, title: 'Tarea creada con filtros', description: null };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(members))
      .mockResolvedValueOnce(jsonResponse(created, 201))
      .mockResolvedValueOnce(jsonResponse([created, ...tasks]));
    await user.selectOptions(statusFilter(), 'COMPLETADO');
    await user.selectOptions(responsibleFilter(), '3');
    await user.click(screen.getByRole('button', { name: 'Nueva tarea' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Nueva tarea' }));
    await user.type(dialog.getByLabelText('Título', { exact: true }), created.title);
    await user.selectOptions(dialog.getByLabelText('Responsable', { exact: true }), '1');
    await user.click(dialog.getByRole('button', { name: 'Crear tarea' }));
    await screen.findByText('La tarea se creó correctamente.');
    await screen.findByText('Mostrando 1 de 4 tareas');
    expect(statusFilter()).toHaveValue('COMPLETADO');
    expect(responsibleFilter()).toHaveValue('3');
    expect(visibleTitles()).toEqual([tasks[2]!.title]);
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(visibleTitles()).toEqual([created.title, ...tasks.map((task) => task.title)]);
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(
      1,
    );
  });

  it('deja de mostrar una tarea editada que cambia de estado y responsable sin perder los criterios', async () => {
    const user = userEvent.setup();
    await openList();
    const edited = {
      ...tasks[0]!,
      status: 'EN_PROCESO' as const,
      responsibleId: 2,
      responsible: members[1]!,
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(members))
      .mockResolvedValueOnce(jsonResponse(edited))
      .mockResolvedValueOnce(jsonResponse([edited, ...tasks.slice(1)]));
    await user.selectOptions(statusFilter(), 'PENDIENTE');
    await user.selectOptions(responsibleFilter(), '1');
    await user.click(screen.getByRole('button', { name: `Editar tarea: ${tasks[0]!.title}` }));
    const dialog = within(screen.getByRole('dialog', { name: 'Editar tarea' }));
    await user.selectOptions(dialog.getByLabelText('Responsable', { exact: true }), '2');
    await user.selectOptions(dialog.getByLabelText('Estado'), 'EN_PROCESO');
    await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Los cambios se guardaron correctamente.');
    await screen.findByText('Mostrando 0 de 3 tareas');
    expect(statusFilter()).toHaveValue('PENDIENTE');
    expect(responsibleFilter()).toHaveValue('1');
    expect(responsibleFilter()).toHaveDisplayValue('Responsable seleccionado (sin tareas)');
    expect(
      screen.getByRole('heading', { name: 'No hay tareas que coincidan con los filtros' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(visibleTitles()).toEqual([edited.title, ...tasks.slice(1).map((task) => task.title)]);
  });

  it('conserva la selección al eliminar la última tarea de un responsable y permite limpiar los filtros', async () => {
    const user = userEvent.setup();
    await openList();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(tasks.slice(1)));
    await user.selectOptions(statusFilter(), 'PENDIENTE');
    await user.selectOptions(responsibleFilter(), '1');
    await user.click(screen.getByRole('button', { name: `Eliminar tarea: ${tasks[0]!.title}` }));
    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }));
    await screen.findByText('La tarea se eliminó correctamente.');
    await screen.findByText('Mostrando 0 de 2 tareas');
    expect(statusFilter()).toHaveValue('PENDIENTE');
    expect(responsibleFilter()).toHaveValue('1');
    expect(responsibleFilter()).toHaveDisplayValue('Responsable seleccionado (sin tareas)');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(responsibleFilter()).toHaveValue('');
    expect(
      screen.queryByRole('option', { name: 'Responsable seleccionado (sin tareas)' }),
    ).not.toBeInTheDocument();
    expect(visibleTitles()).toEqual(tasks.slice(1).map((task) => task.title));
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(
      1,
    );
  });
});
