'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Gate } from '@/components/gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmModal } from '@/components/ui/modal';
import { Notice } from '@/components/ui/notice';
import { api, isApiError } from '@/lib/api';
import { useFlags } from '@/lib/flags';

const Account = () => {
  const router = useRouter();
  const { me, reloadMe } = useFlags();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    try {
      await api.deleteMe();
      await reloadMe();
      router.push('/');
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not delete your data. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-4 px-4 pt-8">
      <h1 className="text-3xl font-black tracking-tight">Account</h1>
      <Card className="space-y-3">
        <p className="text-lg font-extrabold">{me?.name ?? 'Signed in'}</p>
        <Badge>{me?.role}</Badge>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">Delete my data</h2>
        <p className="text-muted">Removes your account, your sets and your votes. This cannot be undone.</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button variant="secondary" loading={busy} onClick={() => setConfirm(true)}>
          Delete my data
        </Button>
      </Card>
      <ConfirmModal
        open={confirm}
        title="Delete everything?"
        message="Your account, sets and votes will be removed for good."
        confirmLabel="Delete my data"
        onConfirm={() => void remove()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
};

const AccountPage = () => (
  <Gate need="user">
    <Account />
  </Gate>
);

export default AccountPage;
