import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { deferredResponse, jsonResponse, tasks } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();
const createdTask = {
  ...tasks[0]!,
  id: 4,
  title: 'Nueva tarea de prueba',
  description: null,
  responsible: 'Elena Díaz',
};
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

async function openCreate(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await screen.findByRole('list');
  await user.click(screen.getByRole('button', { name: 'Nueva tarea' }));
  return within(screen.getByRole('dialog', { name: 'Nueva tarea' }));
}

async function fillCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Título', { exact: true }), createdTask.title);
  await user.type(screen.getByLabelText('Responsable', { exact: true }), createdTask.responsible);
}

describe('Creación y edición', () => {
  it('crea desde una lista vacía, inicia en Pendiente y recarga el listado', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdTask, 201))
      .mockResolvedValueOnce(jsonResponse([createdTask]));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Crear primera tarea' }));
    expect(screen.getByLabelText('Estado')).toHaveValue('PENDIENTE');
    expect(screen.getByLabelText('Título', { exact: true })).toHaveFocus();
    await fillCreate(user);
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(await screen.findByRole('heading', { name: createdTask.title })).toBeInTheDocument();
    expect(screen.getByText('La tarea se creó correctamente.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      title: createdTask.title,
      description: null,
      responsible: createdTask.responsible,
      status: 'PENDIENTE',
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://127.0.0.1:3000/api/tasks');
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toHaveFocus();
  });

  it('valida título, responsable y estado antes de enviar y enfoca el primer error', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks));
    const dialog = await openCreate(user);
    await user.type(screen.getByLabelText('Título', { exact: true }), '   ');
    await user.type(screen.getByLabelText('Responsable', { exact: true }), '   ');
    await user.selectOptions(screen.getByLabelText('Estado'), '');
    await user.click(dialog.getByRole('button', { name: 'Crear tarea' }));
    expect(await screen.findByText('El título es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El responsable es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El estado es obligatorio y debe ser válido.')).toBeInTheDocument();
    expect(screen.getByLabelText('Título', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Título', { exact: true })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Título', 'x'.repeat(151), 'El título no puede superar los 150 caracteres.'],
    ['Responsable', 'x'.repeat(101), 'El responsable no puede superar los 100 caracteres.'],
    [
      'Descripción (opcional)',
      'x'.repeat(2001),
      'La descripción no puede superar los 2.000 caracteres.',
    ],
  ])('valida el límite de %s', async (label, value, message) => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks));
    await openCreate(user);
    await fillCreate(user);
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('recorta los textos, permite descripción opcional y envía el estado seleccionado', async () => {
    const user = userEvent.setup();
    const result = {
      ...createdTask,
      description: 'Primera línea\nSegunda línea',
      status: 'EN_PROCESO',
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockResolvedValueOnce(jsonResponse(result, 201))
      .mockResolvedValueOnce(jsonResponse([result, ...tasks]));
    await openCreate(user);
    await user.type(screen.getByLabelText('Título', { exact: true }), `  ${createdTask.title}  `);
    await user.type(
      screen.getByLabelText('Responsable', { exact: true }),
      ` ${createdTask.responsible} `,
    );
    await user.type(
      screen.getByLabelText('Descripción (opcional)'),
      '  Primera línea\nSegunda línea  ',
    );
    await user.selectOptions(screen.getByLabelText('Estado'), 'EN_PROCESO');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    await screen.findByText('La tarea se creó correctamente.');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      title: createdTask.title,
      responsible: createdTask.responsible,
      description: result.description,
      status: 'EN_PROCESO',
    });
  });

  it('cancelar no escribe y abre un formulario nuevo sin datos anteriores', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks));
    await openCreate(user);
    await fillCreate(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Nueva tarea' }));
    expect(screen.getByLabelText('Título', { exact: true })).toHaveValue('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('conserva todos los datos si falla el guardado y permite reintentarlo', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(createdTask, 201))
      .mockResolvedValueOnce(jsonResponse([createdTask, ...tasks]));
    await openCreate(user);
    await fillCreate(user);
    await user.type(screen.getByLabelText('Descripción (opcional)'), 'Texto que no debe perderse');
    await user.selectOptions(screen.getByLabelText('Estado'), 'COMPLETADO');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor.',
    );
    expect(screen.getByLabelText('Título', { exact: true })).toHaveValue(createdTask.title);
    expect(screen.getByLabelText('Responsable', { exact: true })).toHaveValue(
      createdTask.responsible,
    );
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue(
      'Texto que no debe perderse',
    );
    expect(screen.getByLabelText('Estado')).toHaveValue('COMPLETADO');
    expect(screen.getByRole('button', { name: 'Crear tarea' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    await screen.findByText('La tarea se creó correctamente.');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('muestra los errores por campo enviados por el backend sin perder valores', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks)).mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Revisa los campos enviados.',
            fields: {
              title: ['Título rechazado por el servidor.'],
              responsible: ['Responsable rechazado por el servidor.'],
            },
          },
        },
        400,
      ),
    );
    await openCreate(user);
    await fillCreate(user);
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(await screen.findByText('Título rechazado por el servidor.')).toBeInTheDocument();
    expect(screen.getByText('Responsable rechazado por el servidor.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los campos enviados.');
    expect(screen.getByLabelText('Título', { exact: true })).toHaveValue(createdTask.title);
    expect(screen.getByLabelText('Título', { exact: true })).toHaveFocus();
  });

  it('bloquea campos, cancelar y nuevos envíos mientras se guarda', async () => {
    const user = userEvent.setup();
    const request = deferredResponse();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce(jsonResponse([createdTask, ...tasks]));
    await openCreate(user);
    await fillCreate(user);
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Título', { exact: true })).toBeDisabled();
    const savingButton = screen.getByRole('button', { name: 'Guardando…' });
    expect(savingButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await user.click(savingButton);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      request.resolve(jsonResponse(createdTask, 201));
    });
    await screen.findByText('La tarea se creó correctamente.');
  });

  it('precarga la edición, guarda los cuatro campos y permite quitar la descripción', async () => {
    const user = userEvent.setup();
    const edited = {
      ...tasks[0]!,
      title: 'Alertas revisadas',
      description: null,
      responsible: 'Equipo de soporte',
      status: 'COMPLETADO',
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockResolvedValueOnce(jsonResponse(edited))
      .mockResolvedValueOnce(jsonResponse([edited, ...tasks.slice(1)]));
    render(<App />);
    await user.click(
      await screen.findByRole('button', { name: `Editar tarea: ${tasks[0]!.title}` }),
    );
    expect(screen.getByRole('dialog', { name: 'Editar tarea' })).toBeInTheDocument();
    expect(screen.getByLabelText('Título', { exact: true })).toHaveValue(tasks[0]!.title);
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue(tasks[0]!.description);
    expect(screen.getByLabelText('Responsable', { exact: true })).toHaveValue(
      tasks[0]!.responsible,
    );
    expect(screen.getByLabelText('Estado')).toHaveValue(tasks[0]!.status);
    await user.clear(screen.getByLabelText('Título', { exact: true }));
    await user.type(screen.getByLabelText('Título', { exact: true }), edited.title);
    await user.clear(screen.getByLabelText('Descripción (opcional)'));
    await user.clear(screen.getByLabelText('Responsable', { exact: true }));
    await user.type(screen.getByLabelText('Responsable', { exact: true }), edited.responsible);
    await user.selectOptions(screen.getByLabelText('Estado'), 'COMPLETADO');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('heading', { name: edited.title })).toBeInTheDocument();
    expect(screen.getByText('Los cambios se guardaron correctamente.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://127.0.0.1:3000/api/tasks/3');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      title: edited.title,
      description: null,
      responsible: edited.responsible,
      status: 'COMPLETADO',
    });
  });

  it('editar una descripción nula usa un campo vacío y cancelar conserva la tarea', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks));
    render(<App />);
    const editButton = await screen.findByRole('button', {
      name: `Editar tarea: ${tasks[1]!.title}`,
    });
    await user.click(editButton);
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('');
    await user.type(screen.getByLabelText('Descripción (opcional)'), 'Cambio descartado');
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(editButton).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sin descripción')).toBeInTheDocument();
  });

  it('conserva la edición cuando la tarea ya no existe en el servidor', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'TASK_NOT_FOUND', message: 'La tarea no existe.' } }, 404),
      );
    render(<App />);
    await user.click(
      await screen.findByRole('button', { name: `Editar tarea: ${tasks[0]!.title}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La tarea no existe.');
    expect(screen.getByLabelText('Título', { exact: true })).toHaveValue(tasks[0]!.title);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('mantiene el éxito del guardado si falla la consulta posterior y permite reintentarla', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockResolvedValueOnce(jsonResponse(createdTask, 201))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse([createdTask, ...tasks]));
    await openCreate(user);
    await fillCreate(user);
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor.',
    );
    expect(screen.getByText('La tarea se creó correctamente.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { name: createdTask.title });
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(
      1,
    );
  });
});

describe('Eliminación con confirmación', () => {
  it('identifica la tarea, enfoca Cancelar y no elimina antes de confirmar', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(tasks));
    render(<App />);
    const deleteButton = await screen.findByRole('button', {
      name: `Eliminar tarea: ${tasks[0]!.title}`,
    });
    await user.click(deleteButton);
    const dialog = within(screen.getByRole('dialog', { name: 'Eliminar tarea' }));
    expect(dialog.getByText(`«${tasks[0]!.title}»`)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(dialog.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('elimina solo al confirmar, acepta el 204 sin JSON y vuelve a consultar', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(tasks.slice(1)));
    render(<App />);
    await user.click(
      await screen.findByRole('button', { name: `Eliminar tarea: ${tasks[0]!.title}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }));
    expect(await screen.findByText('La tarea se eliminó correctamente.')).toBeInTheDocument();
    await screen.findByRole('list');
    expect(screen.queryByRole('heading', { name: tasks[0]!.title })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://127.0.0.1:3000/api/tasks/3');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
  });

  it('conserva la confirmación y la tarea si falla la eliminación', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'INTERNAL_ERROR', message: 'No pudimos eliminar la tarea.' } },
          500,
        ),
      );
    render(<App />);
    await user.click(
      await screen.findByRole('button', { name: `Eliminar tarea: ${tasks[0]!.title}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos eliminar la tarea.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: tasks[0]!.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar tarea' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('evita eliminaciones duplicadas y bloquea cancelar durante la solicitud', async () => {
    const user = userEvent.setup();
    const request = deferredResponse();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tasks))
      .mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce(jsonResponse(tasks.slice(1)));
    render(<App />);
    await user.click(
      await screen.findByRole('button', { name: `Eliminar tarea: ${tasks[0]!.title}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }));
    expect(screen.getByRole('button', { name: 'Eliminando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Eliminando…' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      request.resolve(new Response(null, { status: 204 }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
