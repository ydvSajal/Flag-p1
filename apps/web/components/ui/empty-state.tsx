import type { ReactNode } from 'react';

export const EmptyState = ({
  title,
  children,
  action,
  icon = '✦',
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: string;
}) => (
  <div className="anim-pop rounded-chunk border-2 border-dashed border-line bg-surface/60 px-6 py-10 text-center">
    <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-sunken text-2xl" aria-hidden>
      {icon}
    </div>
    <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
    {children ? <p className="mx-auto mt-2 max-w-sm text-muted">{children}</p> : null}
    {action ? <div className="mt-5 flex justify-center gap-3">{action}</div> : null}
  </div>
);
