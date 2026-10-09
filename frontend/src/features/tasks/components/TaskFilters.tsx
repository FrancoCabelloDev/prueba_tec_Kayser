import { useId } from 'react';
import type { TaskFilterValues } from '../tasks.filters';
import { taskStatusSchema } from '../tasks.schema';
import { taskStatusLabels, type Task } from '../tasks.types';

type TaskFiltersProps = {
  value: TaskFilterValues;
  responsibles: Task['responsible'][];
  onChange: (filters: TaskFilterValues) => void;
  onClear: () => void;
};

export function TaskFilters({ value, responsibles, onChange, onClear }: TaskFiltersProps) {
  const id = useId();
  const hasFilters = value.status !== null || value.responsibleId !== null;

  return (
    <div className="task-filters" role="group" aria-label="Filtros de tareas">
      <div className="form-field">
        <label htmlFor={`${id}-status`}>Filtrar por estado</label>
        <select
          id={`${id}-status`}
          value={value.status ?? ''}
          onChange={(event) => {
            const status = taskStatusSchema.options.find((option) => option === event.target.value);
            onChange({ ...value, status: status ?? null });
          }}
        >
          <option value="">Todos los estados</option>
          {taskStatusSchema.options.map((status) => (
            <option key={status} value={status}>
              {taskStatusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={`${id}-responsible`}>Filtrar por responsable</label>
        <select
          id={`${id}-responsible`}
          value={value.responsibleId ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              responsibleId: event.target.value === '' ? null : Number(event.target.value),
            })
          }
        >
          <option value="">Todos los responsables</option>
          {value.responsibleId !== null &&
            !responsibles.some((member) => member.id === value.responsibleId) && (
              <option value={value.responsibleId}>Responsable seleccionado (sin tareas)</option>
            )}
          {responsibles.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} · {member.code}
              {!member.isActive && ' (inactivo)'}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="button button-secondary"
        onClick={onClear}
        disabled={!hasFilters}
      >
        Limpiar filtros
      </button>
    </div>
  );
}
