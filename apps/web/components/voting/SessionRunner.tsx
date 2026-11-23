'use client';

import { useRouter } from 'next/navigation';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { GridView } from './GridView';
import { SwipeView } from './SwipeView';
import { ThisOrThatView } from './ThisOrThatView';
import { VotingFrame } from './VotingFrame';
import { YesNoView } from './YesNoView';
import { useVoting } from './useVoting';

const VotingSkeleton = () => (
  <section className="mx-auto w-full max-w-[720px] space-y-4 px-4 pt-4" aria-busy aria-label="Loading session">
    <Skeleton className="h-12" />
    <Skeleton className="h-8 w-3/4" />
    <div className="grid grid-cols-2 gap-3">
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  </section>
);

/** Renders session.layout (fixed at session start), never the live flag. Skeleton until the session is loaded. */
export const SessionRunner = ({ sessionId }: { sessionId: string }) => {
  const router = useRouter();
  const { state, answer, finishing } = useVoting(sessionId);

  if (state.status === 'loading') return <VotingSkeleton />;
  if (state.status === 'error')
    return (
      <div className="mx-auto max-w-[720px] px-4 pt-10">
        <EmptyState
          icon="!"
          title="Couldn't open that session"
          action={
            <>
              <Button onClick={() => window.location.reload()}>Try again</Button>
              <Link href="/app" className={buttonClass('secondary')}>
                Back home
              </Link>
            </>
          }
        >
          {state.message}
        </EmptyState>
      </div>
    );

  const { session, current, doneCount, announcement } = state;
  const View = { grid: GridView, swipe: SwipeView, this_or_that: ThisOrThatView, yes_no: YesNoView }[session.layout];

  return (
    <VotingFrame
      module={session.module}
      title={current?.title ?? 'Saving your picks'}
      current={doneCount + 1}
      total={session.targetCount}
      announcement={announcement}
      onLeave={() => router.push('/app')}
    >
      {current ? (
        <div key={current.id} className="anim-slide flex flex-1 flex-col">
          <View set={current} onAnswer={answer} />
        </div>
      ) : (
        <p className="py-10 text-center font-bold text-muted" role="status">
          {finishing ? 'Saving your last pick…' : 'Getting the next set…'}
        </p>
      )}
    </VotingFrame>
  );
};
