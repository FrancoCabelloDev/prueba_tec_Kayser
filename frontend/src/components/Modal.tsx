import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

type ModalProps = {
  title: string;
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
  fallbackFocusRef: RefObject<HTMLButtonElement | null>;
};

export function Modal({ title, children, busy, onClose, fallbackFocusRef }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const fallbackFocus = fallbackFocusRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      else fallbackFocus?.focus();
    };
  }, [fallbackFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
