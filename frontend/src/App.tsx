import { useRef, useState } from 'react';
import { DeleteTaskDialog } from './features/tasks/components/DeleteTaskDialog';
import { TaskForm } from './features/tasks/components/TaskForm';
import { TaskList } from './features/tasks/components/TaskList';
import { useTasks } from './features/tasks/hooks/useTasks';
import { createTask, deleteTask, updateTask } from './features/tasks/tasks.api';
import type { Task, TaskInput } from './features/tasks/tasks.types';

type TaskAction = { kind: 'create' } | { kind: 'edit' | 'delete'; task: Task };

export default function App() {
  const { state, reload } = useTasks();
  const [action, setAction] = useState<TaskAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const newTaskButtonRef = useRef<HTMLButtonElement>(null);

  function openAction(nextAction: TaskAction) {
    setNotice(null);
    setAction(nextAction);
  }
  function complete(message: string) {
    setAction(null);
    setNotice(message);
    reload();
  }
  async function save(input: TaskInput) {
    if (action?.kind === 'create') {
      await createTask(input);
      complete('La tarea se creó correctamente.');
    } else if (action?.kind === 'edit') {
      await updateTask(action.task.id, input);
      complete('Los cambios se guardaron correctamente.');
    }
  }
  async function remove() {
    if (action?.kind !== 'delete') return;
    await deleteTask(action.task.id);
    complete('La tarea se eliminó correctamente.');
  }
  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Equipo de TI</p>
          <h1>Tareas del equipo</h1>
          <p className="introduction">Organiza el trabajo de tu equipo en un solo lugar.</p>
        </div>
        <button
          type="button"
          className="button button-primary"
          ref={newTaskButtonRef}
          onClick={() => openAction({ kind: 'create' })}
        >
          Nueva tarea
        </button>
      </header>

      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}

      <section className="workspace-content" aria-labelledby="workspace-title">
        <div className="list-heading">
          <div>
            <h2 id="workspace-title">Tareas registradas</h2>
            {state.status === 'success' && (
              <p className="task-count" role="status">
                {state.tasks.length} {state.tasks.length === 1 ? 'tarea' : 'tareas'}
              </p>
            )}
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={reload}
            disabled={state.status === 'loading'}
          >
            Actualizar
          </button>
        </div>
        {state.status === 'loading' && (
          <div className="feedback-panel" role="status">
            <p>Cargando tareas…</p>
          </div>
        )}
        {state.status === 'error' && (
          <div className="feedback-panel feedback-error" role="alert">
            <h3>No se pudieron cargar las tareas</h3>
            <p>{state.message}</p>
            <button type="button" className="button button-primary" onClick={reload}>
              Reintentar
            </button>
          </div>
        )}
        {state.status === 'success' && (
          <TaskList
            tasks={state.tasks}
            onCreate={() => openAction({ kind: 'create' })}
            onEdit={(task) => openAction({ kind: 'edit', task })}
            onDelete={(task) => openAction({ kind: 'delete', task })}
          />
        )}
      </section>
      {action && action.kind !== 'delete' && (
        <TaskForm
          task={action.kind === 'edit' ? action.task : null}
          onSave={save}
          onCancel={() => setAction(null)}
          fallbackFocusRef={newTaskButtonRef}
        />
      )}
      {action?.kind === 'delete' && (
        <DeleteTaskDialog
          task={action.task}
          onConfirm={remove}
          onCancel={() => setAction(null)}
          fallbackFocusRef={newTaskButtonRef}
        />
      )}
    </main>
  );
}
