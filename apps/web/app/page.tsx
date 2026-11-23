'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFlags } from '@/lib/flags';

const steps = [
  ['Build your set', 'Pair up thumbnails, captions or visuals. Give people two to four options to choose from.'],
  ['Let people pick', 'Guests vote in short sessions. They can join from any screen without an account.'],
  ['Find your favorite', 'See how the votes split across your options before deciding what to publish.'],
] as const;

function ExampleSet() {
  const [pick, setPick] = useState<string | null>(null);
  return (
    <section className="sample" aria-label="Interactive example set">
      <div className="sample-head"><span className="sample-label">Example set</span><span>Cover artwork</span></div>
      <h2>Which cover would you play?</h2>
      <div className="cover-pair">
        {(['Alpine Hours', 'After Hours'] as const).map((title, i) => (
          <button type="button" className="cover" key={title} aria-pressed={pick === title} onClick={() => setPick(title)} aria-label={`Pick ${title}`}>
            <img src={i ? '/studio/after.webp' : '/studio/alpine.webp'} width="550" height="690" alt={`${title}, ${i ? 'apricot' : 'blue'} mountain record sleeve`} />
            <span className="cover-caption"><b>Option {i ? 'B' : 'A'}</b><span aria-hidden="true">{pick === title ? '✓' : ''}</span></span>
          </button>
        ))}
      </div>
      <p role="status" className="sample-foot">{pick ? `You picked ${pick}.` : 'Try it out. Pick a cover.'}</p>
    </section>
  );
}

export default function Landing() {
  const router = useRouter();
  const { me } = useFlags();
  useEffect(() => {
    if (me?.role === 'creator') router.replace('/creator');
    else if (me?.consented) router.replace('/app');
  }, [me, router]);
  return (
    <div className="studio-wrap">
      <div className="studio-hero">
        <section className="hero-copy">
          <h1>Which one<br/>makes <em>the cut?</em></h1>
          <p>Test your thumbnails, captions and visuals with real people before you hit publish.</p>
          <div className="hero-actions"><Link className="studio-primary" href="/login">Create a set</Link><Link className="studio-secondary" href="/start">Start voting</Link></div>
        </section>
        <ExampleSet />
      </div>
      <section className="how" id="how-it-works">
        <h2>From draft to decision</h2>
        <ol>{steps.map(([title, description], i) => <li key={title}><div className="step-title"><span>{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3></div><p>{description}</p></li>)}</ol>
      </section>
    </div>
  );
}
