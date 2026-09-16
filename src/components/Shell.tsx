'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { clearSession, getToken, getUser, subscribe } from '@/lib/auth';
import type { AdminUser } from '@/lib/types';

/**
 * App chrome — dark forest green, ivory text, gold for the active item.
 *
 *   phone   — bottom tab bar with the five daily things, plus "More".
 *   desktop — left sidebar.
 *
 * The auth gate here is a UX affordance, NOT a security boundary. Every admin
 * endpoint re-checks the JWT and role server-side; that check is the real one.
 */

type NavItem = { href: string; label: string; icon: ReactNode; primary?: boolean };

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NAV: NavItem[] = [
  { href: '/', label: 'Home', primary: true, icon: icon('M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5') },
  { href: '/orders', label: 'Orders', primary: true, icon: icon('M4 6h16M4 12h16M4 18h10') },
  { href: '/products', label: 'Products', primary: true, icon: icon('M20 7 12 3 4 7v10l8 4 8-4V7ZM4 7l8 4 8-4M12 11v10') },
  { href: '/inventory', label: 'Stock', primary: true, icon: icon('M3 7h18v12H3zM3 7l2-4h14l2 4M9 12h6') },
  { href: '/coupons', label: 'Coupons', icon: icon('M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z') },
  { href: '/couriers', label: 'Couriers', icon: icon('M3 16V8h11v8M14 11h4l3 3v2h-7M6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z') },
  { href: '/reviews', label: 'Reviews', icon: icon('m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z') },
  { href: '/feedback', label: 'Messages', icon: icon('M20 12a8 8 0 1 1-3.2-6.4M21 4v5h-5') },
  { href: '/settings', label: 'Settings', icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 2.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.5Z') },
  { href: '/users', label: 'Staff', icon: icon('M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 19v-2a4 4 0 0 0-3-3.9M16 1.1a4 4 0 0 1 0 7.8') },
];

const PRIMARY = NAV.filter((n) => n.primary);
const SECONDARY = NAV.filter((n) => !n.primary);

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUser(getToken() ? getUser() : null);
      setChecked(true);
    };
    sync();
    return subscribe(sync);
  }, []);

  useEffect(() => {
    if (checked && !user && pathname !== '/login') router.replace('/login');
  }, [checked, user, pathname, router]);

  useEffect(() => setMoreOpen(false), [pathname]);

  if (pathname === '/login') return <>{children}</>;

  if (!checked || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-chrome)]">
        <p className="ad-eyebrow text-[color:var(--color-on-chrome-dim)]">Checking your session…</p>
      </div>
    );
  }

  const signOut = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* ------------------------------------------------- desktop sidebar */}
      <aside className="hidden w-64 shrink-0 bg-[color:var(--color-chrome)] text-[color:var(--color-on-chrome)] lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 px-6">
          <Mark />
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-none">
              Attar World
            </p>
            <p className="ad-eyebrow mt-1.5 leading-none text-[color:var(--color-accent)]">Admin</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-2">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center gap-3 rounded-lg px-4 py-3 text-[0.9375rem] font-semibold transition-colors ${
                      active
                        ? 'bg-[color:var(--color-chrome-raised)] text-white'
                        : 'text-[color:var(--color-on-chrome-dim)] hover:bg-[color:var(--color-chrome-raised)] hover:text-white'
                    }`}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-0 w-1 rounded-r bg-[color:var(--color-accent)]"
                      />
                    ) : null}
                    <span className={`shrink-0 ${active ? 'text-[color:var(--color-accent)]' : ''}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-5">
          <p className="truncate text-sm font-bold">{user.fullName}</p>
          <p className="truncate text-xs text-[color:var(--color-on-chrome-dim)]">{user.email}</p>
          <span className="mt-2 inline-block rounded-full bg-[color:var(--color-accent)] px-2.5 py-1 text-[0.625rem] font-extrabold uppercase tracking-wider text-[color:var(--color-brand-deep)]">
            {user.role}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="mt-4 block text-sm font-semibold text-[color:var(--color-on-chrome-dim)] underline underline-offset-4 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ---------------------------------------------------------- main */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-[color:var(--color-chrome)] px-4 text-[color:var(--color-on-chrome)] shadow-[var(--shadow-card)] lg:hidden">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="font-[family-name:var(--font-display)] text-lg font-bold">Attar World</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="text-xs font-semibold text-[color:var(--color-on-chrome-dim)] underline underline-offset-4"
          >
            Sign out
          </button>
        </header>

        <main className="ad-page">{children}</main>
      </div>

      {/* ------------------------------------------------ phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 bg-[color:var(--color-chrome)] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(36,10,16,0.45)] lg:hidden"
      >
        <ul className="flex">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-[68px] flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold ${
                    active ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-on-chrome-dim)]'
                  }`}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 top-0 h-1 rounded-b bg-[color:var(--color-accent)]"
                    />
                  ) : null}
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={`flex h-[68px] w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold ${
                SECONDARY.some((s) => isActive(pathname, s.href))
                  ? 'text-[color:var(--color-accent)]'
                  : 'text-[color:var(--color-on-chrome-dim)]'
              }`}
            >
              {icon('M4 12h16M4 6h16M4 18h16')}
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <>
          <div className="ad-scrim lg:hidden" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="ad-sheet lg:hidden" role="dialog" aria-modal="true" aria-label="More pages">
            <div className="flex items-center justify-between px-5 py-4">
              <h2>More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-[color:var(--color-muted)]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-3 px-5 pb-5">
              {SECONDARY.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl bg-[color:var(--color-brand-tint)] text-xs font-bold text-[color:var(--color-brand)]"
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-[color:var(--color-line)] px-5 py-4">
              <p className="truncate text-sm font-bold">{user.fullName}</p>
              <p className="truncate text-xs text-[color:var(--color-muted)]">
                {user.email} · {user.role}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * The company mark — the FULL owner artwork (ring, bottle, flourish), not a
 * cropped circle. The source PNG is 1080x1329 (0.81:1 portrait), so this is
 * sized by height with width auto, matching the storefront's treatment.
 */
function Mark() {
  return (
    <img
      src="/logo-full.png"
      alt=""
      aria-hidden="true"
      className="h-9 w-auto shrink-0"
    />
  );
}
