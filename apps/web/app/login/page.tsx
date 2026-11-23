'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { api, isApiError } from '@/lib/api';
import { useFlags } from '@/lib/flags';

const devLogin = process.env.NEXT_PUBLIC_DEV_LOGIN === '1';

const LoginPage = () => {
  const router = useRouter();
  const { reloadMe } = useFlags();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.devLogin(email.trim());
      await reloadMe();
      router.push('/creator');
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Sign in failed. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="workspace compact space-y-5">
      <h1 className="text-3xl font-black tracking-tight">Post your options</h1>
      <p className="text-muted">Sign in to add a set and see which option wins. Voting needs no account.</p>
      <Card className="space-y-4">
        <a href="/api/auth/google" className={buttonClass('primary', 'w-full')}>
          Continue with Google
        </a>
        {devLogin ? (
          <form onSubmit={submit} className="space-y-3 border-t-2 border-line pt-4">
            <Field label="Dev login email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} hint="Local mode only." />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button type="submit" variant="secondary" loading={busy} disabled={!email.trim()} className="w-full">
              Sign in
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
};

export default LoginPage;
