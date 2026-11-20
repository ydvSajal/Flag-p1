'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { OptionMedia } from './OptionMedia';
import type { ViewProps } from './types';

/** Layout A (control): tap a tile, then confirm. Arrow keys move the selection, Enter confirms. */
export const GridView = ({ set, onAnswer }: ViewProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const ids = set.variants.map((v) => v.id);

  const move = (from: number, delta: number) => {
    const next = (from + delta + ids.length) % ids.length;
    setSelected(ids[next] ?? null);
    tiles.current[next]?.focus();
  };

  const confirm = () => selected && onAnswer([{ variantId: selected, signal: 'pick' }]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div role="radiogroup" aria-label={set.title} className="grid grid-cols-2 gap-3">
        {set.variants.map((v, i) => {
          const on = selected === v.id;
          return (
            <button
              key={v.id}
              ref={(el) => {
                tiles.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={v.kind === 'text' ? v.text : `Option ${i + 1}`}
              tabIndex={on || (selected === null && i === 0) ? 0 : -1}
              onClick={() => setSelected(on ? null : v.id)}
              onKeyDown={(e) => {
                const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                if (delta) {
                  e.preventDefault();
                  move(i, delta);
                } else if (e.key === 'Enter' && selected) {
                  e.preventDefault();
                  confirm();
                }
              }}
              className={cn(
                'relative min-h-11 rounded-chunk border-2 p-2 text-left transition',
                on ? 'border-accent bg-surface ring-4 ring-accent/40' : 'border-line bg-surface hover:bg-sunken',
              )}
            >
              <OptionMedia variant={v} title={set.title} index={i} frameClass="h-36 sm:h-48" />
              {on ? (
                <span className="anim-check absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-accent font-extrabold text-accent-ink" aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <Button className="mt-auto w-full" disabled={!selected} onClick={confirm}>
        Confirm pick
      </Button>
    </div>
  );
};
