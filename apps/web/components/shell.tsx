'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useFlags } from '@/lib/flags';

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const path = usePathname();
  const active = path === href || (href !== '/' && path.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold hover:bg-sunken',
        active && 'bg-sunken',
      )}
    >
      {children}
    </Link>
  );
};

/** Role-aware top bar. Hidden on the voting screen, which has its own frame. */
export const TopBar = () => {
  const path = usePathname();
  const { me } = useFlags();
  if (/^\/app\/session\/[^/]+$/.test(path)) return null;
  const creator = me?.role === 'creator';

  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-[720px] items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="flex min-h-11 items-center gap-2 text-xl font-black tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg border-2 border-line bg-accent text-accent-ink" aria-hidden>
            P
          </span>
          PickLab
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center justify-end gap-1">
          <NavLink href="/app">Vote</NavLink>
          {creator ? (
            <>
              <NavLink href="/creator">My sets</NavLink>
              <NavLink href="/creator/new">New set</NavLink>
            </>
          ) : (
            <NavLink href="/login">Post options</NavLink>
          )}
          {me?.isAdmin ? <NavLink href="/admin">Admin</NavLink> : null}
          {me && !me.isAnonymous ? <NavLink href="/account">Account</NavLink> : null}
        </nav>
      </div>
    </header>
  );
};

export const Footer = () => (
  <footer className="mx-auto mt-16 flex max-w-[720px] flex-wrap items-center justify-between gap-3 px-4 pb-10 text-sm text-muted">
    <span>PickLab. A live Flagsmith A/B test.</span>
    <span className="flex gap-4">
      <Link href="/about-test" className="inline-flex min-h-6 items-center underline underline-offset-2">
        About this test
      </Link>
      <Link href="/privacy" className="inline-flex min-h-6 items-center underline underline-offset-2">
        Privacy
      </Link>
    </span>
  </footer>
);
