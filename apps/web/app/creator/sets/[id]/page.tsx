'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MODULE_LABEL, type SetResultsResponse } from '@picklab/shared';
import NotFound from '@/app/not-found';
import { ResultBar } from '@/components/creator/result-bar';
import { Gate } from '@/components/gate';
import { Badge, VIEW_LABEL, viewColor } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { usePoll } from '@/lib/use-poll';

const pctOf = (positive: number, voters: number) => (voters > 0 ? Math.round((positive / voters) * 100) : 0);

const ByLayout = ({ data }: { data: NonNullable<SetResultsResponse['byLayout']> }) => (
  <Card className="space-y-3">
    <h2 className="text-lg font-extrabold">By view (admin)</h2>
    {data.map((l) => (
      <div key={l.layout} className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-bold">
          <span className="size-3 rounded-full" style={{ background: viewColor(l.layout) }} aria-hidden />
          {VIEW_LABEL[l.layout]}: {l.voters} voters
        </p>
        <ul className="space-y-1 text-sm tabular-nums">
          {l.options.map((o, i) => (
            <li key={o.variantId}>
              Option {i + 1}: {pctOf(o.positive, l.voters)}% ({o.positive})
            </li>
          ))}
        </ul>
      </div>
    ))}
  </Card>
);

const Results = ({ id }: { id: string }) => {
  const { data, error, loading, reload } = usePoll(() => api.getSetResults(id), 15_000);

  if (error?.status === 404) return <NotFound />;
  if (loading) return <Skeleton className="mx-auto mt-8 h-48 max-w-[720px]" />;
  if (!data) {
    return (
      <div className="mx-auto max-w-[720px] space-y-3 px-4 pt-8">
        <Notice tone="error">{error?.message ?? 'Could not load results.'}</Notice>
        <Button variant="secondary" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }

  const ranked = data.options
    .map((o) => ({ ...o, pct: pctOf(o.positive, data.voters) }))
    .sort((a, b) => b.pct - a.pct || b.positive - a.positive);
  const top = ranked[0]?.pct ?? 0;

  return (
    <div className="workspace space-y-4">
      <Link href="/creator" className="text-sm font-bold underline underline-offset-2">
        My sets
      </Link>
      <h1 className="break-words text-3xl font-black tracking-tight">{data.title}</h1>
      <p className="flex items-center gap-2 text-sm font-bold">
        <Badge>{MODULE_LABEL[data.module]}</Badge>
        {data.voters} {data.voters === 1 ? 'voter' : 'voters'}
      </p>
      {data.voters === 0 ? (
        <EmptyState title="Waiting for votes">Results appear here as people vote. This page refreshes itself.</EmptyState>
      ) : (
        <>
          {data.voters < 10 ? <Notice>Under 10 voters so far. Treat this as a hint, not a result.</Notice> : null}
          <ul className="workspace-grid">
            {ranked.map((o, i) => (
              <ResultBar
                key={o.variantId}
                rank={i + 1}
                pct={o.pct}
                positive={o.positive}
                winner={top > 0 && o.pct === top && ranked.filter((r) => r.pct === top).length === 1}
                imageUrl={o.imageUrl}
                text={o.text}
              />
            ))}
          </ul>
        </>
      )}
      {data.byLayout ? <ByLayout data={data.byLayout} /> : null}
      <Link href="/creator/new" className={buttonClass('secondary')}>
        Post another set
      </Link>
    </div>
  );
};

const ResultsPage = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <Gate need="creator">
      <Results id={id} />
    </Gate>
  );
};

export default ResultsPage;
