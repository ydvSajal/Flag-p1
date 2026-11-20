'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './button';

type ModalProps = { open: boolean; title: string; onClose: () => void; children?: ReactNode; footer?: ReactNode };

/** Native <dialog>: focus trap, Escape and backdrop come from the platform. */
export const Modal = ({ open, title, onClose, children, footer }: ModalProps) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,26rem)] rounded-chunk border-2 border-line bg-surface p-6 text-ink shadow-chunk backdrop:bg-black/50"
    >
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      {children ? <div className="mt-2 text-muted">{children}</div> : null}
      {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
    </dialog>
  );
};

type ConfirmProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmModal = ({ open, title, message, confirmLabel, cancelLabel = 'Stay', onConfirm, onCancel }: ConfirmProps) => (
  <Modal
    open={open}
    title={title}
    onClose={onCancel}
    footer={
      <>
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm}>{confirmLabel}</Button>
      </>
    }
  >
    {message}
  </Modal>
);
