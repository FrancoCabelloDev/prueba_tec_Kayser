import { TaskList } from './features/tasks/components/TaskList';
import { useTasks } from './features/tasks/hooks/useTasks';

export default function App() {
  const { state, reload } = useTasks();
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
          disabled
          aria-describedby="management-note"
        >
          Nueva tarea
        </button>
      </header>

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
        {state.status === 'success' && <TaskList tasks={state.tasks} />}
        <p id="management-note" className="management-note">
          Las acciones de crear, editar y eliminar estarán disponibles próximamente.
        </p>
      </section>
    </main>
  );
}
