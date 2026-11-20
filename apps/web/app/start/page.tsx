'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useFlags } from '@/lib/flags';

/** P-05. The only step between a link and the first vote. The button is the consent. */
const Start = () => {
  const router = useRouter();
  const { me, meError, reloadMe } = useFlags();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (me?.consented) router.replace('/app');
  }, [me, router]);

  const accept = async () => {
    setBusy(true);
    setError(false);
    try {
      await api.consent();
      await reloadMe();
      router.push('/app');
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-6 px-4 pt-10">
      <h1 className="text-4xl font-black tracking-tighter sm:text-5xl">Before you vote</h1>
      <Card className="space-y-3 text-lg">
        <p>PickLab is running a real experiment. You will see one of several voting layouts.</p>
        <p>We record your picks, how long you take, and which layout you saw.</p>
        <p className="font-bold">No account needed. Nothing is sold or shared.</p>
      </Card>
      {meError || error ? <Notice tone="error">Something went wrong. Check your connection and try again.</Notice> : null}
      {me || meError ? (
        <Button className="min-h-14 w-full text-lg" loading={busy} disabled={!me} onClick={accept}>
          Got it, start
        </Button>
      ) : (
        <Skeleton className="h-14 rounded-full" />
      )}
      <p className="text-sm text-muted">
        Full details on the{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy page
        </Link>
        .
      </p>
    </div>
  );
};

export default Start;
