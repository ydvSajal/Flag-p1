'use client';

import Link from 'next/link';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

const ErrorPage = ({ reset }: { error: Error; reset: () => void }) => (
  <div className="mx-auto max-w-[720px] px-4 pt-12">
    <EmptyState
      icon="!"
      title="Something broke"
      action={
        <>
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className={buttonClass('secondary')}>
            Back to start
          </Link>
        </>
      }
    >
      Not your fault. Give it another go.
    </EmptyState>
  </div>
);

export default ErrorPage;
