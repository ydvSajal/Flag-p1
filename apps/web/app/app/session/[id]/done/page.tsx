'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ModuleKey } from '@picklab/shared';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { startSession } from '@/lib/session';

type Summary = { picks: number; again: ModuleKey | null };

/** P-08. */
const Done = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [session, mods] = await Promise.all([api.getSession(id), api.getModules()]);
        const again = mods.modules.find((m) => m.key === session.module && m.setsLeft > 0)?.key ?? null;
        setSummary({ picks: session.doneCount, again });
      } catch {
        setSummary({ picks: 0, again: null });
      }
    })();
  }, [id]);

  const share = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: 'PickLab', url });
      else {
        await navigator.clipboard.writeText(url);
        toast.show('Link copied');
      }
    } catch {
      /* share dismissed */
    }
  };

  const again = async (module: ModuleKey) => {
    setBusy(true);
    try {
      router.push(`/app/session/${(await startSession(module)).id}`);
    } catch {
      setBusy(false);
      toast.show('Could not start another session', { tone: 'error' });
    }
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-6 px-4 pt-10">
      <div className="anim-pop space-y-3">
        <p className="text-6xl" aria-hidden>
          🎉
        </p>
        <h1 className="text-4xl font-black tracking-tighter sm:text-5xl">
          {summary && summary.picks > 0 ? `${summary.picks} picks in. Thanks!` : 'Session done. Thanks!'}
        </h1>
        <p className="text-lg text-muted">Real creators will use these to choose what to post.</p>
      </div>
      {!summary ? (
        <Skeleton className="h-14" />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          {summary.again ? (
            <Button className="min-h-14 text-lg" loading={busy} onClick={() => void again(summary.again as ModuleKey)}>
              Another session
            </Button>
          ) : null}
          <Link href="/app" className={buttonClass(summary.again ? 'secondary' : 'primary', 'min-h-14 text-lg')}>
            Back home
          </Link>
        </div>
      )}
      <Card className="flex items-center justify-between gap-3">
        <p className="font-bold">Know someone who has a strong opinion?</p>
        <Button variant="secondary" onClick={() => void share()}>
          Share
        </Button>
      </Card>
    </div>
  );
};

export default Done;
