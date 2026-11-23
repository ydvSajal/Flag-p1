'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import NotFound from '@/app/not-found';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { useFlags } from '@/lib/flags';

type Need = 'admin' | 'creator' | 'user';

const Frame = ({ children }: { children: ReactNode }) => <div className="mx-auto max-w-[720px] px-4 pt-8">{children}</div>;

/** Guards a page by role. Admin pages show the 404 page to everyone else, never a hint that they exist. */
export const Gate = ({ need, children }: { need: Need; children: ReactNode }) => {
  const { me, meError } = useFlags();

  if (!me) {
    if (need === 'admin') return meError ? <NotFound /> : <Skeleton className="mx-auto mt-8 h-40 max-w-[720px]" />;
    return (
      <Frame>
        {meError ? <Notice tone="error">Could not reach the server. Try again in a moment.</Notice> : <Skeleton className="h-40" />}
      </Frame>
    );
  }
  if (need === 'admin') return me.isAdmin ? <>{children}</> : <NotFound />;

  const allowed = need === 'creator' ? me.role === 'creator' : !me.isAnonymous;
  if (allowed) return <>{children}</>;
  return (
    <Frame>
      <EmptyState
        title="Sign in first"
        action={
          <Link href="/login" className={buttonClass()}>
            Sign in
          </Link>
        }
      >
        {need === 'creator' ? 'Posting options needs a creator account.' : 'You are only a guest right now.'}
      </EmptyState>
    </Frame>
  );
};
