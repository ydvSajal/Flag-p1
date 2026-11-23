'use client';

import { NewSetForm } from '@/components/creator/new-set-form';
import { Gate } from '@/components/gate';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { usePoll } from '@/lib/use-poll';

const Body = () => {
  const { data, error, loading, reload } = usePoll(api.getModules, null);
  if (loading) return <Skeleton className="h-64" />;
  if (!data) {
    return (
      <div className="space-y-3">
        <Notice tone="error">{error?.message ?? 'Could not load modules.'}</Notice>
        <Button variant="secondary" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }
  if (data.modules.length === 0) {
    return <EmptyState title="No modules are open">New sets are paused right now. Check back soon.</EmptyState>;
  }
  return <NewSetForm modules={data.modules.map((m) => m.key)} />;
};

const NewSetPage = () => (
  <Gate need="creator">
    <div className="workspace space-y-4">
      <h1 className="text-3xl font-black tracking-tight">New set</h1>
      <Body />
    </div>
  </Gate>
);

export default NewSetPage;
