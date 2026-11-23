'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFlags } from '@/lib/flags';

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || (href === '/creator' && path.startsWith('/creator/sets/'));
  return <Link href={href} aria-current={active ? 'page' : undefined}>{children}</Link>;
}

export function TopBar() {
  const path = usePathname();
  const { me } = useFlags();
  if (/^\/app\/session\/[^/]+$/.test(path)) return null;
  const creator = me?.role === 'creator';
  return (
    <header className="studio-header"><div className="header-inner">
      <Link href="/" className="wordmark"><span className="brand-mark" aria-hidden="true" />PickLab</Link>
      <nav aria-label="Main" className="studio-nav">
        {path === '/' && <Link href="#how-it-works" className="how-link">How it works</Link>}
        <NavLink href={me?.consented ? '/app' : '/start'}>Vote</NavLink>
        {creator && <NavLink href="/creator">My sets</NavLink>}
        {me?.isAdmin && <NavLink href="/admin">Admin</NavLink>}
        {me && !me.isAnonymous && <NavLink href="/account">Account</NavLink>}
        <Link className="nav-action" href={creator ? '/creator/new' : '/login'}>{creator ? 'New set' : 'Creator studio'}</Link>
      </nav>
    </div></header>
  );
}

export function Footer() {
  const path = usePathname();
  if (/^\/app\/session\/[^/]+$/.test(path)) return null;
  return <footer className="studio-footer"><span>PickLab <span aria-hidden="true">/</span> Powered by Flagsmith</span><div><Link href="/about-test">About the experiment</Link><Link href="/privacy">Privacy</Link></div></footer>;
}
