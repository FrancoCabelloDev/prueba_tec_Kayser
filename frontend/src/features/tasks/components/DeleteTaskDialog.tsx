import { useRef, useState, type RefObject } from 'react';
import { Modal } from '../../../components/Modal';
import type { Task } from '../tasks.types';

type DeleteTaskDialogProps = {
  task: Task;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  fallbackFocusRef: RefObject<HTMLButtonElement | null>;
};

export function DeleteTaskDialog({
  task,
  onConfirm,
  onCancel,
  fallbackFocusRef,
}: DeleteTaskDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deletingRef = useRef(false);

  async function confirm() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No pudimos eliminar la tarea.');
    } finally {
      deletingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Eliminar tarea"
      busy={busy}
      onClose={onCancel}
      fallbackFocusRef={fallbackFocusRef}
    >
      <p className="delete-description">
        ¿Quieres eliminar la tarea <strong>«{task.title}»</strong>? Esta acción no se puede
        deshacer.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="field-hint">
          Eliminando tarea…
        </p>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
          disabled={busy}
          autoFocus
        >
          Cancelar
        </button>
        <button
          type="button"
          className="button button-danger-solid"
          onClick={() => {
            void confirm();
          }}
          disabled={busy}
        >
          {busy ? 'Eliminando…' : 'Eliminar tarea'}
        </button>
      </div>
    </Modal>
  );
}
