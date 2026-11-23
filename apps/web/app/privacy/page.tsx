import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy | PickLab' };

const Privacy = () => (
  <article className="mx-auto max-w-[720px] space-y-5 px-4 pt-10 text-lg leading-relaxed">
    <h1 className="text-4xl font-black tracking-tighter sm:text-5xl">Privacy</h1>
    <h2 className="pt-2 text-2xl font-extrabold">Voters</h2>
    <p>
      We give your browser a random id in a cookie. We store that id, your picks, how long each took, the layout you saw
      and which test group (wave) you are in. No name, no email.
    </p>
    <h2 className="pt-2 text-2xl font-extrabold">Creators</h2>
    <p>If you sign in with Google we also store your name and email, and the options you post.</p>
    <h2 className="pt-2 text-2xl font-extrabold">Flagsmith</h2>
    <p>
      Your random id and group are sent to Flagsmith to decide which features and layout you get, and to count test
      results.
    </p>
    <h2 className="pt-2 text-2xl font-extrabold">Sharing and deleting</h2>
    <p>
      Nothing is sold or shared. You can delete all your data from your account page; guests can ask the team to remove
      their id.
    </p>
  </article>
);

export default Privacy;
