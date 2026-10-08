import { useEffect, useId, useRef, type RefObject } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../../components/Modal';
import { TaskApiError } from '../tasks.api';
import { useTeamMembers } from '../../team-members/useTeamMembers';
import { taskFormSchema } from '../tasks.schema';
import { taskStatusLabels, type Task, type TaskFormValues, type TaskInput } from '../tasks.types';

type TaskFormProps = {
  task: Task | null;
  onSave: (input: TaskInput) => Promise<void>;
  onCancel: () => void;
  fallbackFocusRef: RefObject<HTMLButtonElement | null>;
};

export function TaskForm({ task, onSave, onCancel, fallbackFocusRef }: TaskFormProps) {
  const id = useId();
  const catalog = useTeamMembers();
  const historicalMember =
    catalog.status === 'ready' &&
    task &&
    !catalog.members.some((member) => member.id === task.responsibleId)
      ? task.responsible
      : null;
  const canSave =
    catalog.status === 'ready' && (catalog.members.length > 0 || Boolean(historicalMember));
  const savingRef = useRef(false);
  const serverErrorFocusRef = useRef<keyof TaskFormValues | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setFocus,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues, unknown, TaskInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      responsibleId: task ? String(task.responsibleId) : '',
      status: task?.status ?? 'PENDIENTE',
    },
  });

  useEffect(() => {
    // The options arrive after the select mounts; restore the stored form value then.
    if (catalog.status === 'ready') setValue('responsibleId', getValues('responsibleId'));
  }, [catalog.status, getValues, setValue]);

  useEffect(() => {
    // Los campos deben estar habilitados antes de enfocar un error recibido de la API.
    if (!isSubmitting && serverErrorFocusRef.current) {
      setFocus(serverErrorFocusRef.current);
      serverErrorFocusRef.current = null;
    }
  }, [isSubmitting, setFocus]);

  async function submit(input: TaskInput) {
    if (savingRef.current || !canSave) return;
    const selected =
      catalog.members.some((member) => member.id === input.responsibleId) ||
      (task && input.responsibleId === task.responsibleId);
    if (!selected) {
      setError(
        'responsibleId',
        { message: 'Selecciona un integrante disponible.' },
        { shouldFocus: true },
      );
      return;
    }
    savingRef.current = true;
    clearErrors('root');
    try {
      await onSave(input);
    } catch (error) {
      setError('root.server', {
        message: error instanceof Error ? error.message : 'No pudimos guardar la tarea.',
      });
      if (error instanceof TaskApiError) {
        const fields = ['title', 'description', 'responsibleId', 'status'] as const;
        let firstField: (typeof fields)[number] | undefined;
        for (const field of fields) {
          const message = error.fields[field]?.[0];
          if (message) {
            setError(field, { type: 'server', message });
            firstField ??= field;
          }
        }
        if (firstField) serverErrorFocusRef.current = firstField;
      }
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <Modal
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      busy={isSubmitting}
      onClose={onCancel}
      fallbackFocusRef={fallbackFocusRef}
    >
      <p className="form-introduction">Título, responsable y estado son obligatorios.</p>
      <form
        onSubmit={(event) => {
          void handleSubmit(submit)(event);
        }}
        noValidate
      >
        <fieldset disabled={isSubmitting} className="form-fields">
          <div className="form-field">
            <label htmlFor={`${id}-title`}>Título</label>
            <input
              id={`${id}-title`}
              {...register('title')}
              required
              aria-invalid={Boolean(errors.title)}
              aria-describedby={`${id}-title-hint ${id}-title-error`}
            />
            <p className="field-hint" id={`${id}-title-hint`}>
              Máximo 150 caracteres.
            </p>
            <p className="field-error" id={`${id}-title-error`}>
              {errors.title?.message}
            </p>
          </div>
          <div className="form-field">
            <label htmlFor={`${id}-description`}>Descripción (opcional)</label>
            <textarea
              id={`${id}-description`}
              {...register('description')}
              rows={4}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={`${id}-description-hint ${id}-description-error`}
            />
            <p className="field-hint" id={`${id}-description-hint`}>
              Máximo 2.000 caracteres.
            </p>
            <p className="field-error" id={`${id}-description-error`}>
              {errors.description?.message}
            </p>
          </div>
          <div className="form-field">
            <label htmlFor={`${id}-responsible`}>Responsable</label>
            <select
              id={`${id}-responsible`}
              {...register('responsibleId')}
              required
              disabled={catalog.status !== 'ready'}
              aria-invalid={Boolean(errors.responsibleId)}
              aria-describedby={`${id}-responsible-hint ${id}-responsible-error`}
            >
              <option value="">Selecciona un integrante</option>
              {historicalMember && (
                <option value={historicalMember.id}>
                  {historicalMember.name} · {historicalMember.code} (inactivo; conservar asignación)
                </option>
              )}
              {catalog.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.code}
                </option>
              ))}
            </select>
            <p className="field-hint" id={`${id}-responsible-hint`}>
              Selecciona un integrante activo del equipo. Puedes conservar al responsable inactivo
              actual al editar.
            </p>
            <p className="field-error" id={`${id}-responsible-error`}>
              {errors.responsibleId?.message}
            </p>
            {catalog.status === 'loading' && <p role="status">Cargando integrantes…</p>}
            {catalog.status === 'error' && (
              <div role="alert">
                <p>{catalog.message}</p>
                <button type="button" className="button button-secondary" onClick={catalog.retry}>
                  Reintentar integrantes
                </button>
              </div>
            )}
            {catalog.status === 'ready' && catalog.members.length === 0 && (
              <p role="status">
                No hay integrantes activos disponibles.
                {historicalMember
                  ? ' Puedes conservar al responsable actual.'
                  : ' No se puede crear una tarea hasta que haya integrantes activos.'}
              </p>
            )}
          </div>
          <div className="form-field">
            <label htmlFor={`${id}-status`}>Estado</label>
            <select
              id={`${id}-status`}
              {...register('status')}
              required
              aria-invalid={Boolean(errors.status)}
              aria-describedby={`${id}-status-error`}
            >
              <option value="">Selecciona un estado</option>
              {Object.entries(taskStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="field-error" id={`${id}-status-error`}>
              {errors.status?.message}
            </p>
          </div>
        </fieldset>
        {errors.root?.server && (
          <p className="form-error" role="alert">
            {errors.root.server.message}
          </p>
        )}
        {isSubmitting && (
          <p role="status" className="field-hint">
            Guardando tarea…
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting || !canSave}
          >
            {isSubmitting ? 'Guardando…' : task ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
