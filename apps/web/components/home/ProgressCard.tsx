import type { ModuleInfo } from '@picklab/shared';
import { Card } from '@/components/ui/card';

export const ProgressCard = ({ modules }: { modules: ModuleInfo[] }) => {
  const open = modules.filter((m) => m.openSessionId).length;
  const sets = modules.reduce((n, m) => n + Math.min(m.setsLeft, m.setsPerSession), 0);
  return (
    <Card className="bg-ink text-bg">
      <p className="text-sm font-extrabold uppercase tracking-wide opacity-70">Your session</p>
      <p className="mt-1 text-2xl font-black tracking-tight">
        {open > 0
          ? `${open} in progress. Pick up where you left off.`
          : sets > 0
            ? `Pick a module and make ${Math.max(...modules.map((m) => m.setsPerSession))} quick picks.`
            : 'You are all caught up.'}
      </p>
    </Card>
  );
};
