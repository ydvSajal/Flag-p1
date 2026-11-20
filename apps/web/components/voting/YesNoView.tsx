'use client';

import { useRef, useState } from 'react';
import type { ResponseItem } from '@picklab/shared';
import { Button } from '@/components/ui/button';
import { OptionMedia } from './OptionMedia';
import { useKeys } from './hooks';
import type { ViewProps } from './types';

/** Layout D: one option at a time, two big buttons, auto-advance. Y / N keys. No card motion. */
export const YesNoView = ({ set, onAnswer }: ViewProps) => {
  const [index, setIndex] = useState(0);
  const answers = useRef<ResponseItem[]>([]);
  const done = useRef(false);
  const variant = set.variants[index];

  const answer = (signal: 'yes' | 'no') => {
    if (done.current || !variant) return;
    answers.current = [...answers.current, { variantId: variant.id, signal }];
    if (index + 1 >= set.variants.length) {
      done.current = true;
      onAnswer(answers.current);
    } else setIndex(index + 1);
  };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (k === 'y') answer('yes');
    if (k === 'n') answer('no');
  });

  if (!variant) return null;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-center text-sm font-bold text-muted">
        Option {index + 1} of {set.variants.length}
      </p>
      <div className="rounded-chunk border-2 border-line bg-surface p-2">
        <OptionMedia variant={variant} title={set.title} index={index} frameClass="h-56 sm:h-72" />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3">
        <Button variant="secondary" className="min-h-14" onClick={() => answer('no')} aria-keyshortcuts="N">
          No
        </Button>
        <Button className="min-h-14" onClick={() => answer('yes')} aria-keyshortcuts="Y">
          Yes
        </Button>
      </div>
    </div>
  );
};
