import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About this test | PickLab' };

const AboutTest = () => (
  <article className="mx-auto max-w-[720px] space-y-5 px-4 pt-10 text-lg leading-relaxed">
    <h1 className="text-4xl font-black tracking-tighter sm:text-5xl">About this test</h1>
    <p>
      PickLab is a small product built to run a live A/B test with Flagsmith. The question: does the way we ask people to
      vote change how many of them finish?
    </p>
    <h2 className="pt-2 text-2xl font-extrabold">What you see</h2>
    <p>
      Each visitor gets one of four voting layouts: a grid, swipe cards, this-or-that, or yes/no. Flagsmith picks the
      layout when you start a session, and it stays the same until the session ends.
    </p>
    <h2 className="pt-2 text-2xl font-extrabold">What we measure</h2>
    <p>Whether you finish a session, and how long each pick takes. We compare layouts, not people.</p>
    <h2 className="pt-2 text-2xl font-extrabold">What it is not</h2>
    <p>There is no payment, prize or reward for voting. Your picks help creators choose between options.</p>
  </article>
);

export default AboutTest;
