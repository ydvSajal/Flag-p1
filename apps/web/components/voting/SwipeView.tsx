'use client';

import { useRef, useState, type PointerEvent } from 'react';
import type { ResponseItem } from '@picklab/shared';
import { Button } from '@/components/ui/button';
import { OptionMedia } from './OptionMedia';
import { useKeys, useReducedMotion } from './hooks';
import type { ViewProps } from './types';

const THRESHOLD = 90;
const EXIT_MS = 180;

/** Layout B: one card per option. Drag right = yes, left = no. Buttons and arrow keys do the same. */
export const SwipeView = ({ set, onAnswer }: ViewProps) => {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [exiting, setExiting] = useState<'yes' | 'no' | null>(null);
  const start = useRef<number | null>(null);
  const answers = useRef<ResponseItem[]>([]);
  const busy = useRef(false);
  const variant = set.variants[index];

  const commit = (signal: 'yes' | 'no') => {
    if (busy.current || !variant) return;
    busy.current = true;
    answers.current = [...answers.current, { variantId: variant.id, signal }];
    const finish = () => {
      setDx(0);
      setExiting(null);
      if (index + 1 >= set.variants.length) {
        onAnswer(answers.current);
        return;
      }
      setIndex(index + 1);
      busy.current = false;
    };
    if (reduced) return finish();
    setExiting(signal);
    window.setTimeout(finish, EXIT_MS);
  };

  useKeys((e) => {
    if (e.key === 'ArrowRight') commit('yes');
    if (e.key === 'ArrowLeft') commit('no');
  });

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (busy.current) return;
    start.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current !== null && !reduced) setDx(e.clientX - start.current);
  };
  const onUp = () => {
    if (start.current === null) return;
    const moved = dx;
    start.current = null;
    if (Math.abs(moved) > THRESHOLD) commit(moved > 0 ? 'yes' : 'no');
    else setDx(0);
  };

  if (!variant) return null;
  const x = exiting ? (exiting === 'yes' ? 500 : -500) : dx;
  const style = reduced
    ? undefined
    : {
        transform: `translateX(${x}px) rotate(${x / 18}deg)`,
        transition: start.current === null ? `transform ${EXIT_MS}ms ease-out` : 'none',
        touchAction: 'pan-y' as const,
      };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="relative flex-1">
        <div
          key={variant.id}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={style}
          className="relative cursor-grab select-none rounded-chunk border-2 border-line bg-surface p-2 shadow-chunk active:cursor-grabbing"
        >
          <OptionMedia variant={variant} title={set.title} index={index} frameClass="h-64 sm:h-80" />
          {dx > 30 ? <span className="absolute left-4 top-4 rounded-full bg-good px-3 py-1 font-extrabold text-white">YES</span> : null}
          {dx < -30 ? <span className="absolute right-4 top-4 rounded-full bg-bad px-3 py-1 font-extrabold text-white">NO</span> : null}
        </div>
      </div>
      <p className="text-center text-sm font-bold text-muted">
        Card {index + 1} of {set.variants.length}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" className="min-h-14" onClick={() => commit('no')} aria-label="Pass (left arrow)">
          ✕ Pass
        </Button>
        <Button className="min-h-14" onClick={() => commit('yes')} aria-label="Pick (right arrow)">
          ✓ Pick
        </Button>
      </div>
    </div>
  );
};
