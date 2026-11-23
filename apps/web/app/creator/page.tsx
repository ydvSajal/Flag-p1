'use client';

import Link from 'next/link';
import { SetCard } from '@/components/creator/set-card';
import { Gate } from '@/components/gate';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { usePoll } from '@/lib/use-poll';

const MySets = () => {
  const { data, error, loading, reload } = usePoll(api.getMySets, null);

  return (
    <div className="workspace space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight">My sets</h1>
        <Link href="/creator/new" className={buttonClass()}>
          New set
        </Link>
      </div>
      {loading ? (
        <>
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </>
      ) : error && !data ? (
        <div className="space-y-3">
          <Notice tone="error">{error.message}</Notice>
          <Button variant="secondary" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : data && data.sets.length === 0 ? (
        <EmptyState
          title="No sets yet"
          action={
            <Link href="/creator/new" className={buttonClass()}>
              Post your first set
            </Link>
          }
        >
          Add 2 to 4 options and see which one wins.
        </EmptyState>
      ) : (
        <div className="workspace-grid">{data?.sets.map((s) => <SetCard key={s.id} set={s} />)}</div>
      )}
    </div>
  );
};

const CreatorPage = () => (
  <Gate need="creator">
    <MySets />
  </Gate>
);

export default CreatorPage;
