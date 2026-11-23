'use client';

import { useState, type ReactNode } from 'react';
import { MODULE_LABEL, type ModuleKey } from '@picklab/shared';
import { ConfirmModal } from '@/components/ui/modal';
import { Progress } from '@/components/ui/progress';

type Props = {
  module: ModuleKey;
  title: string;
  /** 1-based number of the set being shown. */
  current: number;
  total: number;
  /** Screen reader message, e.g. "Pick saved, set 2 of 5". */
  announcement: string;
  onLeave: () => void;
  children: ReactNode;
};

/** Shared frame for every layout: close with confirm, progress, prompt, live region. */
export const VotingFrame = ({ module, title, current, total, announcement, onLeave, children }: Props) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] flex-col gap-4 px-4 pb-6 pt-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{MODULE_LABEL[module]}</p>
            <p className="font-extrabold">
              Set {Math.min(current, total)} of {total}
            </p>
          </div>
          <button
            type="button"
            aria-label="Leave session"
            onClick={() => setConfirming(true)}
            className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-line bg-surface text-lg font-bold hover:bg-sunken"
          >
            ✕
          </button>
        </div>
        <Progress value={Math.max(0, current - 1)} max={total} label="Session progress" />
      </header>
      <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
      <div className="flex flex-1 flex-col">{children}</div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <ConfirmModal
        open={confirming}
        title="Leave this session?"
        message="Your saved picks stay. You can pick up where you left off from home."
        confirmLabel="Leave"
        cancelLabel="Keep voting"
        onCancel={() => setConfirming(false)}
        onConfirm={onLeave}
      />
    </section>
  );
};
