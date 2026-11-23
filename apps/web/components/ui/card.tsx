import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// cn() does not resolve Tailwind conflicts, so the default background is dropped when the caller sets one.
export const Card = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('rounded-chunk border border-soft p-5 shadow-chunk', !/(^|\s)bg-/.test(className ?? '') && 'bg-surface', className)}
    {...rest}
  />
);
