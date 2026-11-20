import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Card = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-chunk border-2 border-line bg-surface p-5 shadow-chunk', className)} {...rest} />
);
