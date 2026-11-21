'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LiveTable } from '@/components/admin/live-table';
import { SplitBars } from '@/components/admin/split-bars';
import { Gate } from '@/components/gate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { usePoll } from '@/lib/use-poll';

const Counter = ({ label, value }: { label: string; value: number }) => (
  <Card className="p-4 text-center">
    <p className="text-4xl font-black tabular-nums">{value}</p>
    <p className="text-sm font-bold text-muted">{label}</p>
  </Card>
);

const Live = () => {
  const [paused, setPaused] = useState(false);
  const { data, error, loading } = usePoll(api.getAdminLive, paused ? null : 5000);

  return (
    <div className="mx-auto max-w-[960px] space-y-5 px-4 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight">Live</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="inline-flex min-h-8 items-center px-1 text-sm font-bold underline underline-offset-2">
            Stats
          </Link>
          <Button variant="secondary" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
        </div>
      </div>
      {error ? <Notice tone="error">{data ? `Refresh failed: ${error.message}` : error.message}</Notice> : null}
      {loading ? (
        <Skeleton className="h-64" />
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Counter label="On site" value={data.counters.onSite} />
            <Counter label="Sessions today" value={data.counters.sessionsToday} />
            <Counter label="Finished today" value={data.counters.finishedToday} />
          </div>
          <Card className="space-y-3">
            <h2 className="text-lg font-extrabold">Split, last hour</h2>
            <SplitBars split={data.split} />
          </Card>
          {data.visitors.length === 0 ? (
            <EmptyState title="No visitors yet">Rows appear as people open the site.</EmptyState>
          ) : (
            <LiveTable visitors={data.visitors} now={data.now} />
          )}
          <p className="text-sm text-muted">{paused ? 'Paused.' : 'Refreshes every 5 seconds.'}</p>
        </>
      ) : null}
    </div>
  );
};

const LivePage = () => (
  <Gate need="admin">
    <Live />
  </Gate>
);

export default LivePage;
