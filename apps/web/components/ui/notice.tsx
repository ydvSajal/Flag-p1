import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Notice = ({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) => (
  <p
    role={tone === 'error' ? 'alert' : 'status'}
    className={cn(
      'anim-pop rounded-2xl border-2 border-line px-4 py-3 text-sm font-bold',
      tone === 'error' ? 'bg-bad/15 text-bad' : 'bg-sunken',
    )}
  >
    {children}
  </p>
);
