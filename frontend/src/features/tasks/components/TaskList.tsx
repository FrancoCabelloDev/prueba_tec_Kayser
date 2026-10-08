import type { Task } from '../tasks.types';
import { TaskCard } from './TaskCard';

type TaskListProps = { tasks: Task[] };

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="feedback-panel">
        <h3>No hay tareas registradas</h3>
        <p>Cuando registres la primera tarea, aparecerá aquí.</p>
        <button
          type="button"
          className="button button-primary"
          disabled
          aria-describedby="management-note"
        >
          Crear primera tarea
        </button>
      </div>
    );
  }

  return (
    <ul className="task-list" aria-label="Tareas registradas">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </ul>
  );
}
