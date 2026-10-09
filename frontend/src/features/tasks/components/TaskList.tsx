import type { Task } from '../tasks.types';
import { TaskCard } from './TaskCard';

type TaskListProps = {
  tasks: Task[];
  totalCount: number;
  onCreate: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

export function TaskList({ tasks, totalCount, onCreate, onEdit, onDelete }: TaskListProps) {
  if (tasks.length === 0) {
    if (totalCount > 0) {
      return (
        <div className="feedback-panel">
          <h3>No hay tareas que coincidan con los filtros</h3>
          <p>Selecciona otros criterios o utiliza Limpiar filtros para ver todas las tareas.</p>
        </div>
      );
    }
    return (
      <div className="feedback-panel">
        <h3>No hay tareas registradas</h3>
        <p>Cuando registres la primera tarea, aparecerá aquí.</p>
        <button type="button" className="button button-primary" onClick={onCreate}>
          Crear primera tarea
        </button>
      </div>
    );
  }

  return (
    <ul className="task-list" aria-label="Tareas registradas">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </ul>
  );
}
