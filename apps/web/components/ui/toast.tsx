'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; tone: 'info' | 'error'; action?: ToastAction };
type ShowOptions = { tone?: Toast['tone']; action?: ToastAction; ms?: number };
type ToastApi = { show: (message: string, options?: ShowOptions) => void };

const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast needs ToastProvider');
  return ctx;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, { tone = 'info', action, ms = 5000 } = {}) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'anim-pop pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-2 border-line px-4 py-3 text-sm font-bold shadow-chunk',
              t.tone === 'error' ? 'bg-bad text-white' : 'bg-ink text-bg',
            )}
          >
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="min-h-11 rounded-full px-3 underline underline-offset-2"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
