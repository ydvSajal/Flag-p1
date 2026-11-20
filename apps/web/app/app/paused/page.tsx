'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { LIMITS } from '@picklab/shared';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';

/** P-09. Also the generic maintenance state. Retry (and a 15 s check) returns home once voting is back. */
const Paused = () => {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [stillPaused, setStillPaused] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.getModules();
      if (res.votingEnabled) return router.replace('/app');
      setStillPaused(true);
    } catch {
      setStillPaused(true);
    }
    setChecking(false);
  }, [router]);

  useEffect(() => {
    const t = window.setInterval(() => void check(), LIMITS.flagRefreshMs);
    return () => window.clearInterval(t);
  }, [check]);

  return (
    <div className="mx-auto max-w-[720px] px-4 pt-12">
      <EmptyState
        icon="⏸"
        title="Voting is paused for a moment"
        action={
          <>
            <Button loading={checking} onClick={() => void check()}>
              Retry
            </Button>
            <Link href="/" className={buttonClass('secondary')}>
              Back to start
            </Link>
          </>
        }
      >
        {stillPaused ? 'Still paused. We will let you back in as soon as it is on.' : "We'll be right back."}
      </EmptyState>
    </div>
  );
};

export default Paused;
