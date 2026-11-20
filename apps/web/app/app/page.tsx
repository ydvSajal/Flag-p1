'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ModuleKey } from '@picklab/shared';
import { ModuleCard } from '@/components/home/ModuleCard';
import { ProgressCard } from '@/components/home/ProgressCard';
import { useModules } from '@/components/home/useModules';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api';
import { useFlags } from '@/lib/flags';
import { startSession } from '@/lib/session';

const MESSAGES: Record<string, string> = {
  module_off: 'That module just closed. Here is what is open.',
};

/** P-06. Only what is open for this visitor; hidden modules never appear. */
const Home = () => {
  const router = useRouter();
  const { me } = useFlags();
  const { data, failed, fresh, reload } = useModules();
  const [starting, setStarting] = useState<ModuleKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const msg = new URLSearchParams(window.location.search).get('msg');
    if (msg && MESSAGES[msg]) setMessage(MESSAGES[msg]);
  }, []);

  useEffect(() => {
    if (me && !me.consented) router.replace('/start');
  }, [me, router]);

  const start = async (key: ModuleKey) => {
    setStarting(key);
    try {
      const session = await startSession(key);
      router.push(`/app/session/${session.id}`);
    } catch (e) {
      setStarting(null);
      if (isApiError(e, 'voting_paused')) return router.replace('/app/paused');
      if (isApiError(e, 'consent_required')) return router.replace('/start');
      setMessage(
        isApiError(e, 'module_off')
          ? MESSAGES.module_off ?? null
          : isApiError(e, 'no_sets_left')
            ? 'No sets left in that module. Come back soon.'
            : 'Could not start. Please try again.',
      );
      void reload();
    }
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-5 px-4 pt-8">
      <h1 className="text-4xl font-black tracking-tighter sm:text-5xl">Ready to pick?</h1>
      {message ? <Notice>{message}</Notice> : null}
      {failed && !data ? (
        <EmptyState icon="!" title="Couldn't load modules" action={<Button onClick={() => void reload()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : !data ? (
        <div className="space-y-4" aria-busy aria-label="Loading modules">
          <Skeleton className="h-24" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : data.modules.length === 0 ? (
        <EmptyState icon="⏳" title="Your group opens soon">
          Nothing is open for you yet. This page updates by itself.
        </EmptyState>
      ) : (
        <>
          <ProgressCard modules={data.modules} />
          <ul className="space-y-4">
            {data.modules.map((m) => (
              <li key={m.key}>
                <ModuleCard info={m} isNew={fresh.has(m.key)} busy={starting === m.key} onStart={() => void start(m.key)} />
              </li>
            ))}
          </ul>
          {failed ? <Notice tone="error">Having trouble refreshing. Showing the last list.</Notice> : null}
        </>
      )}
    </div>
  );
};

export default Home;
