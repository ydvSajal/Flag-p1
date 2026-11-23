'use client';

import Link from 'next/link';
import { Gate } from '@/components/gate';
import { Button } from '@/components/ui/button';
import { VIEW_LABEL, ViewBadge, viewColor } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { usePoll } from '@/lib/use-poll';

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const th = 'px-3 py-2 text-left text-sm font-extrabold';
const td = 'px-3 py-2.5 tabular-nums';
const linkClass = 'inline-flex min-h-8 items-center px-1 underline underline-offset-2 font-bold';

const Stats = () => {
  const { data, error, loading, reload } = usePoll(api.getAdminOverview, null);

  if (loading) return <Skeleton className="mx-auto mt-8 h-64 max-w-[960px]" />;
  if (!data) {
    return (
      <div className="mx-auto max-w-[960px] space-y-3 px-4 pt-8">
        <Notice tone="error">{error?.message ?? 'Could not load stats.'}</Notice>
        <Button variant="secondary" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }
  const waves = data.visitorsByWave;

  return (
    <div className="mx-auto max-w-[960px] space-y-5 px-4 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight">Stats</h1>
        <Link href="/admin/live" className={linkClass}>
          Live view
        </Link>
      </div>
      <div className="overflow-x-auto rounded-chunk border-2 border-line bg-surface">
        <table className="w-full min-w-[36rem] border-collapse">
          <caption className="sr-only">Results per view</caption>
          <thead className="border-b-2 border-line bg-sunken">
            <tr>
              <th className={th}>View</th>
              <th className={th}>Visitors</th>
              <th className={th}>Started</th>
              <th className={th}>Completed</th>
              <th className={th}>Completion</th>
              <th className={th}>Avg time per set</th>
            </tr>
          </thead>
          <tbody>
            {data.byLayout.map((l) => (
              <tr key={l.layout} className="border-t border-line/40">
                <td className={td}>
                  <ViewBadge layout={l.layout} />
                </td>
                <td className={td}>{l.visitors}</td>
                <td className={td}>{l.started}</td>
                <td className={td}>{l.completed}</td>
                <td className={`${td} font-bold`}>{pct(l.completed, l.started)}%</td>
                <td className={td}>{(l.avgDurationMs / 1000).toFixed(1)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">Completion by view</h2>
        <ul className="space-y-2">
          {data.byLayout.map((l) => (
            <li key={l.layout} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 font-bold sm:grid-cols-[9rem_1fr_3rem]">
              <span className="truncate">{VIEW_LABEL[l.layout]}</span>
              <div className="h-5 overflow-hidden rounded-full border-2 border-line bg-sunken">
                <div className="h-full" style={{ width: `${pct(l.completed, l.started)}%`, background: viewColor(l.layout) }} />
              </div>
              <span className="text-right tabular-nums">{pct(l.completed, l.started)}%</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-1">
          <h2 className="text-lg font-extrabold">Visitors by wave</h2>
          <p className="tabular-nums">Wave 1: {waves['1']}</p>
          <p className="tabular-nums">Wave 2: {waves['2']}</p>
          <p className="tabular-nums">Wave 3: {waves['3']}</p>
          <p className="pt-1 text-sm text-muted">{data.responsesTotal} responses in total</p>
        </Card>
        <Card className="space-y-2">
          <h2 className="text-lg font-extrabold">Flagsmith</h2>
          <p>
            <a className={linkClass} href={data.links.flag} target="_blank" rel="noreferrer">
              Flag
            </a>
          </p>
          <p>
            <a className={linkClass} href={data.links.experiment} target="_blank" rel="noreferrer">
              Experiment
            </a>
          </p>
          <p>
            <a className={linkClass} href={data.links.identities} target="_blank" rel="noreferrer">
              Identities
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
};

const AdminPage = () => (
  <Gate need="admin">
    <Stats />
  </Gate>
);

export default AdminPage;
