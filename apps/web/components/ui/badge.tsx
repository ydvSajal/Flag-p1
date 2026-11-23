import type { Layout } from '@picklab/shared';
import { cn } from '@/lib/cn';

/** Voting view labels and colours. ONE colour per view, defined in globals.css (--view-*), reused on admin pages. */
export const VIEW_LABEL: Record<Layout, string> = {
  grid: 'Grid',
  swipe: 'Swipe',
  this_or_that: 'This or that',
  yes_no: 'Yes / No',
};

/** CSS colour value for a view, usable in `style` (bars, dots, borders). */
export const viewColor = (layout: Layout): string => `var(--view-${layout})`;

export const ViewBadge = ({ layout, className }: { layout: Layout; className?: string }) => (
  <span
    className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', className)}
    style={{ background: viewColor(layout), color: `var(--view-${layout}-ink)` }}
  >
    <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
    {VIEW_LABEL[layout]}
  </span>
);

type Tone = 'accent' | 'neutral' | 'good';
const tones: Record<Tone, string> = {
  accent: 'bg-accent text-accent-ink',
  neutral: 'bg-sunken text-ink',
  good: 'bg-good text-white',
};

export const Badge = ({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide', tones[tone], className)}>
    {children}
  </span>
);
