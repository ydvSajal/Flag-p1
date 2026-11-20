'use client';

import { useMemo, useRef, useState } from 'react';
import { knockoutRounds } from '@picklab/shared';
import { OptionMedia } from './OptionMedia';
import type { ViewProps } from './types';

/** Layout C: head to head. 2 options = 1 round; more = winner-stays-on knockout (rules.knockoutRounds). */
export const ThisOrThatView = ({ set, onAnswer }: ViewProps) => {
  const rounds = useMemo(() => knockoutRounds(set.variants.map((v) => v.id)), [set.variants]);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const done = useRef(false);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);

  const current = rounds[round];
  const leftId = current ? (current.left ?? winner) : null;
  const rightId = current?.right ?? null;
  const byId = (id: string | null) => set.variants.findIndex((v) => v.id === id);

  const choose = (id: string) => {
    if (done.current) return;
    if (round >= rounds.length - 1) {
      done.current = true;
      onAnswer([{ variantId: id, signal: 'pick' }]);
      return;
    }
    setWinner(id);
    setRound(round + 1);
  };

  if (!leftId || !rightId) return null;

  const sides = [leftId, rightId].map((id) => ({ id, index: byId(id) }));

  return (
    <div className="flex flex-1 flex-col gap-3">
      {rounds.length > 1 ? (
        <p className="text-center text-sm font-bold text-muted">
          Round {round + 1} of {rounds.length}
        </p>
      ) : null}
      <div
        key={round}
        role="group"
        aria-label={set.title}
        className="anim-slide grid flex-1 grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]"
        onKeyDown={(e) => {
          const i = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 0 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
          if (i < 0) return;
          e.preventDefault();
          btns.current[i]?.focus();
        }}
      >
        {sides.map(({ id, index }, i) => {
          const v = set.variants[index];
          if (!v) return null;
          return (
            <div key={id} className="contents">
              {i === 1 ? <div className="grid place-items-center text-sm font-extrabold uppercase text-muted">vs</div> : null}
              <button
                ref={(el) => {
                  btns.current[i] = el;
                }}
                type="button"
                onClick={() => choose(id)}
                aria-label={v.kind === 'text' ? v.text : `Pick option ${index + 1}`}
                className="min-h-11 rounded-chunk border-2 border-line bg-surface p-2 transition hover:-translate-y-0.5 hover:shadow-chunk active:translate-y-0"
              >
                <OptionMedia variant={v} title={set.title} index={index} frameClass="h-40 sm:h-64" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
