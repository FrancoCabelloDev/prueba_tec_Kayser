import { createRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskForm } from '../src/features/tasks/components/TaskForm';
import App from '../src/App';
import { createTask, updateTask } from '../src/features/tasks/tasks.api';
import { deferredResponse, jsonResponse, members, tasks } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
function form(task = null as (typeof tasks)[number] | null) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const view = render(
    <TaskForm
      task={task}
      onSave={onSave}
      onCancel={onCancel}
      fallbackFocusRef={createRef<HTMLButtonElement>()}
    />,
  );
  return { ...view, onSave, onCancel };
}

describe('Selector de responsables registrados', () => {
  it('bloquea el guardado durante la carga y cancela la consulta al cerrar', async () => {
    fetchMock.mockReturnValueOnce(deferredResponse().promise);
    const view = form();
    expect(screen.getByText('Cargando integrantes…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear tarea' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/team-members');
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('muestra un error, conserva los textos y permite recuperar el catálogo', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(members));
    form();
    await user.type(screen.getByLabelText('Título', { exact: true }), 'Texto conservado');
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.getByRole('button', { name: 'Crear tarea' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar integrantes' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Responsable', { exact: true })).toBeEnabled(),
    );
    expect(screen.getByLabelText('Título', { exact: true })).toHaveValue('Texto conservado');
    expect(screen.getByLabelText('Responsable', { exact: true })).toHaveValue('');
  });

  it('explica el catálogo vacío y bloquea crear una tarea', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    form();
    expect(await screen.findByText(/No hay integrantes activos disponibles/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear tarea' })).toBeDisabled();
  });

  it('permite conservar al responsable inactivo de la tarea incluso con un catálogo activo vacío', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const task = {
      ...tasks[0]!,
      responsibleId: 99,
      responsible: { id: 99, code: 'LEGACY-99-0', name: 'Responsable histórico', isActive: false },
    };
    const { onSave } = form(task);
    await screen.findByRole('option', { name: /Responsable histórico.*inactivo/ });
    expect(screen.getByLabelText('Responsable', { exact: true })).toHaveValue('99');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        title: task.title,
        description: task.description,
        responsibleId: 99,
        status: task.status,
      }),
    );
  });

  it('distingue homónimos por código y envía únicamente el identificador numérico seleccionado', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { ...members[0], id: 101, code: 'TI-101' },
        { ...members[0], id: 102, code: 'TI-102' },
      ]),
    );
    const { onSave } = form();
    await screen.findByRole('option', { name: 'Ana Pérez · TI-102' });
    expect(screen.getByRole('option', { name: 'Ana Pérez · TI-101' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Título', { exact: true }), 'Asignar');
    await user.selectOptions(screen.getByLabelText('Responsable', { exact: true }), '102');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        title: 'Asignar',
        description: null,
        responsibleId: 102,
        status: 'PENDIENTE',
      }),
    );
  });

  it.each([
    ['integrantes inactivos', [{ ...members[0], isActive: false }]],
    ['identificadores duplicados', [members[0], { ...members[1], id: members[0]!.id }]],
    ['códigos duplicados', [members[0], { ...members[1], code: members[0]!.code }]],
  ])('rechaza un catálogo con %s', async (_case, catalog) => {
    const pending = deferredResponse();
    fetchMock.mockReturnValueOnce(pending.promise);
    form();
    await act(async () => pending.resolve(jsonResponse(catalog)));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El catálogo recibido no tiene el formato esperado.',
    );
    expect(screen.getByRole('button', { name: 'Crear tarea' })).toBeDisabled();
  });

  it('precarga al editar el identificador correcto cuando las opciones llegan después', async () => {
    const pending = deferredResponse();
    fetchMock.mockReturnValueOnce(pending.promise);
    const task = tasks[1]!;
    const { onSave } = form(task);
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    await act(async () => pending.resolve(jsonResponse(members)));
    const selector = screen.getByLabelText('Responsable', { exact: true });
    await waitFor(() => expect(selector).toHaveValue(String(task.responsibleId)));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        title: task.title,
        description: task.description,
        responsibleId: task.responsibleId,
        status: task.status,
      }),
    );
  });

  it('permite reasignar del responsable inactivo actual a un integrante activo', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([members[1]]));
    const task = { ...tasks[0]!, responsible: { ...tasks[0]!.responsible, isActive: false } };
    const { onSave } = form(task);
    await screen.findByRole('option', { name: /Ana Pérez.*inactivo/ });
    await user.selectOptions(screen.getByLabelText('Responsable', { exact: true }), '2');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        title: task.title,
        description: task.description,
        responsibleId: 2,
        status: task.status,
      }),
    );
  });

  it.each(['crear', 'editar'] as const)(
    'conserva los datos y permite elegir otro integrante si la API rechaza al desactivado al %s',
    async (operation) => {
      const user = userEvent.setup();
      const input = {
        title: 'Texto que debe conservarse',
        description: 'Descripción pendiente de guardar',
        responsibleId: 3,
        status: 'EN_PROCESO' as const,
      };
      fetchMock
        .mockResolvedValueOnce(jsonResponse(members))
        .mockResolvedValueOnce(
          jsonResponse(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Revisa los campos enviados.',
                fields: { responsibleId: ['Selecciona un integrante activo del equipo.'] },
              },
            },
            400,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              ...tasks[0],
              ...input,
              responsible: members[2],
            },
            operation === 'crear' ? 201 : 200,
          ),
        );
      const { onSave } = form(operation === 'crear' ? null : tasks[0]!);
      onSave.mockImplementation(async (data) => {
        if (operation === 'crear') await createTask(data);
        else await updateTask(tasks[0]!.id, data);
      });
      await screen.findByRole('option', { name: 'Luis Torres · TI-002' });
      const title = screen.getByLabelText('Título', { exact: true });
      const description = screen.getByLabelText('Descripción (opcional)', { exact: true });
      const selector = screen.getByLabelText('Responsable', { exact: true });
      const status = screen.getByLabelText('Estado', { exact: true });
      await user.clear(title);
      await user.type(title, input.title);
      await user.clear(description);
      await user.type(description, input.description);
      await user.selectOptions(selector, '2');
      await user.selectOptions(status, input.status);
      const submit = screen.getByRole('button', {
        name: operation === 'crear' ? 'Crear tarea' : 'Guardar cambios',
      });
      await user.click(submit);
      expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los campos enviados.');
      expect(screen.getByText('Selecciona un integrante activo del equipo.')).toBeInTheDocument();
      await waitFor(() => expect(selector).toHaveFocus());
      expect(selector).toHaveAttribute('aria-invalid', 'true');
      expect(title).toHaveValue(input.title);
      expect(description).toHaveValue(input.description);
      expect(selector).toHaveValue('2');
      expect(status).toHaveValue(input.status);
      expect(onSave).toHaveBeenCalledTimes(1);
      await user.selectOptions(selector, '3');
      await user.click(submit);
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(submit).toBeEnabled());
      expect(onSave).toHaveBeenLastCalledWith(input);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(selector).toHaveAttribute('aria-invalid', 'false');
    },
  );

  it('cancela al cerrar y no sustituye el catálogo nuevo con una respuesta tardía del anterior', async () => {
    const user = userEvent.setup();
    const oldRequest = deferredResponse();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(jsonResponse([members[1]]));
    render(<App />);
    await screen.findByText('0 tareas');
    const open = screen.getByRole('button', { name: 'Nueva tarea' });
    await user.click(open);
    const oldSignal = fetchMock.mock.calls[1]?.[1]?.signal;
    expect(screen.getByText('Cargando integrantes…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(oldSignal?.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(open).toHaveFocus();
    await user.click(open);
    await screen.findByRole('option', { name: 'Luis Torres · TI-002' });
    await act(async () => oldRequest.resolve(jsonResponse([members[0]])));
    expect(screen.getByRole('option', { name: 'Luis Torres · TI-002' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ana Pérez · TI-001' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Responsable', { exact: true })).toHaveValue('');
  });
});
