import { MODULE_KIND, type ModuleInfo } from '@picklab/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

const ICON = { image: '🖼', text: '✍' } as const;

type Props = { info: ModuleInfo; isNew: boolean; busy: boolean; onStart: () => void };

/** One module, one session. Each card has its own Start / Continue. */
export const ModuleCard = ({ info, isNew, busy, onStart }: Props) => {
  const empty = info.setsLeft === 0 && !info.openSessionId;
  return (
    <Card className={cn('anim-pop flex flex-col gap-3', isNew && 'ring-4 ring-accent/50')}>
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sunken text-2xl" aria-hidden>
          {ICON[MODULE_KIND[info.key]]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight">{info.title}</h2>
            {isNew ? <Badge tone="accent">New</Badge> : null}
          </div>
          {info.instructions ? <p className="mt-1 text-muted">{info.instructions}</p> : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-muted">
          {empty ? 'No sets left, come back soon' : `${info.setsLeft} ${info.setsLeft === 1 ? 'set' : 'sets'} left`}
        </p>
        <Button disabled={empty} loading={busy} onClick={onStart}>
          {info.openSessionId ? 'Continue' : 'Start'}
        </Button>
      </div>
    </Card>
  );
};
