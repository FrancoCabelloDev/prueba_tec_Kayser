import { useCallback, useEffect, useState } from 'react';
import { listTasks } from '../tasks.api';
import type { Task } from '../tasks.types';

type TaskListState =
  | { status: 'loading' }
  | { status: 'success'; tasks: Task[] }
  | { status: 'error'; message: string };

export function useTasks() {
  const [state, setState] = useState<TaskListState>({ status: 'loading' });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void listTasks(controller.signal)
      .then((tasks) => {
        if (!controller.signal.aborted) setState({ status: 'success', tasks });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'No pudimos consultar las tareas.',
        });
      });

    // Evita que una respuesta anterior cambie una pantalla desmontada o una consulta nueva.
    return () => controller.abort();
  }, [requestVersion]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setRequestVersion((version) => version + 1);
  }, []);

  return { state, reload };
}
