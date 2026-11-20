'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { buttonClass } from '@/components/ui/button';
import { useFlags } from '@/lib/flags';

const STEPS = [
  ['1', 'Post', 'Add 2 to 4 options.'],
  ['2', 'Pick', 'Real people vote.'],
  ['3', 'See', 'Watch the winner rise.'],
] as const;

/** P-01. One screen. Returning visitors skip straight on. */
const Landing = () => {
  const router = useRouter();
  const { me } = useFlags();

  useEffect(() => {
    if (!me) return;
    if (me.role === 'creator') router.replace('/creator');
    else if (me.consented) router.replace('/app');
  }, [me, router]);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-8 px-4 pt-10 sm:pt-16">
      <div className="anim-pop space-y-5">
        <p className="inline-block -rotate-1 rounded-full border-2 border-line bg-accent px-3 py-1 text-sm font-extrabold text-accent-ink">
          A tiny experiment, live now
        </p>
        <h1 className="text-5xl font-black leading-[0.95] tracking-tighter sm:text-7xl">
          Which one <span className="underline decoration-accent decoration-8 underline-offset-4">wins?</span>
          <br />
          Let real people pick.
        </h1>
        <p className="max-w-md text-lg text-muted">Thumbnails, captions, visuals. Vote in a minute, or post your own.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/start" className={buttonClass('primary', 'min-h-14 text-lg')}>
          Start voting
        </Link>
        <Link href="/login" className={buttonClass('secondary', 'min-h-14 text-lg')}>
          Post options
        </Link>
      </div>
      <ol className="grid grid-cols-3 gap-3">
        {STEPS.map(([n, title, text]) => (
          <li key={n} className="rounded-chunk border-2 border-line bg-surface p-3 sm:p-4">
            <span className="text-2xl font-black text-accent">{n}</span>
            <p className="font-extrabold">{title}</p>
            <p className="text-sm text-muted">{text}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        Part of a live Flagsmith A/B test.{' '}
        <Link href="/about-test" className="underline underline-offset-2">
          What does that mean?
        </Link>
      </p>
    </div>
  );
};

export default Landing;
