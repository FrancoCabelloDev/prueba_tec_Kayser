import { taskStatusLabels, type Task } from '../tasks.types';

type TaskCardProps = { task: Task };

export function TaskCard({ task }: TaskCardProps) {
  return (
    <li className="task-card">
      <div className="task-card-heading">
        <h3>{task.title}</h3>
        <span className={`task-status task-status--${task.status.toLowerCase()}`}>
          {taskStatusLabels[task.status]}
        </span>
      </div>
      <p className={`task-description${task.description ? '' : ' muted'}`}>
        {task.description || 'Sin descripción'}
      </p>
      <dl className="task-responsible">
        <dt>Responsable</dt>
        <dd>{task.responsible}</dd>
      </dl>
      <div className="task-actions">
        <button
          type="button"
          className="button button-secondary"
          disabled
          aria-label={`Editar tarea: ${task.title}`}
          aria-describedby="management-note"
        >
          Editar
        </button>
        <button
          type="button"
          className="button button-danger"
          disabled
          aria-label={`Eliminar tarea: ${task.title}`}
          aria-describedby="management-note"
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}
