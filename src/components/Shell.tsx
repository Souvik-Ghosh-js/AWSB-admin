'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { clearSession, getToken, getUser, subscribe } from '@/lib/auth';
import type { AdminUser } from '@/lib/types';

/**
 * App chrome.
 *
 *   phone   — bottom tab bar with the five things done daily, plus a "More"
 *             sheet for the rest. Thumbs reach the bottom of a phone, not the
 *             top, so the primary navigation lives there.
 *   desktop — a conventional left sidebar.
 *
 * The auth gate here is a UX affordance, NOT a security boundary: it stops a
 * signed-out person staring at empty tables. Every admin endpoint re-checks the
 * JWT and role server-side, and that check is the real one.
 */

type NavItem = { href: string; label: string; icon: ReactNode; primary?: boolean };

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
  { href: '/feedback', label: 'Feedback', icon: icon('M20 12a8 8 0 1 1-3.2-6.4M21 4v5h-5') },
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

  // The login page draws itself, without chrome.
  if (pathname === '/login') return <>{children}</>;

  if (!checked || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="ad-eyebrow">Checking your session…</p>
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
      <aside className="hidden w-60 shrink-0 border-r border-[color:var(--color-line)] bg-[color:var(--color-surface)] lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-[color:var(--color-line)] px-5">
          <Mark />
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-display)] text-[0.95rem] leading-none text-[color:var(--color-brand)]">
              Attar World
            </p>
            <p className="ad-eyebrow mt-1 leading-none">Admin</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    isActive(pathname, item.href)
                      ? 'bg-[color:var(--color-brand-tint)] font-medium text-[color:var(--color-brand)]'
                      : 'text-[color:var(--color-soft)] hover:bg-[color:var(--color-surface-alt)]'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-[color:var(--color-line)] p-4">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-[color:var(--color-muted)]">{user.email}</p>
          <span className="ad-pill ad-pill-muted mt-2">{user.role}</span>
          <button type="button" onClick={signOut} className="ad-btn ad-btn-ghost ad-btn-sm mt-3 w-full">
            Sign out
          </button>
        </div>
      </aside>

      {/* ---------------------------------------------------------- main */}
      <div className="min-w-0 flex-1">
        {/* Phone header: identity only. Navigation lives at the bottom. */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <Mark />
            <span className="font-[family-name:var(--font-display)] text-[0.95rem] text-[color:var(--color-brand)]">
              Attar World
            </span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="text-xs text-[color:var(--color-muted)] underline underline-offset-4"
          >
            Sign out
          </button>
        </header>

        <main className="ad-page">{children}</main>
      </div>

      {/* ------------------------------------------------ phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
      >
        <ul className="flex">
          {PRIMARY.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.625rem] font-medium ${
                  isActive(pathname, item.href)
                    ? 'text-[color:var(--color-brand)]'
                    : 'text-[color:var(--color-muted)]'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.625rem] font-medium ${
                SECONDARY.some((s) => isActive(pathname, s.href))
                  ? 'text-[color:var(--color-brand)]'
                  : 'text-[color:var(--color-muted)]'
              }`}
            >
              {icon('M4 12h16M4 6h16M4 18h16')}
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* "More" sheet for the pages that are not part of the daily loop. */}
      {moreOpen ? (
        <>
          <div className="ad-scrim lg:hidden" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="ad-sheet lg:hidden" role="dialog" aria-modal="true" aria-label="More pages">
            <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-5 py-4">
              <h2 className="text-lg">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-[color:var(--color-muted)]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="ad-divide px-2 py-2">
              {SECONDARY.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-[52px] items-center gap-3 rounded-md px-3 text-sm text-[color:var(--color-ink)]"
                  >
                    <span className="text-[color:var(--color-muted)]">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-[color:var(--color-line)] px-5 py-4">
              <p className="truncate text-sm font-medium">{user.fullName}</p>
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

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0 text-[color:var(--color-brand)]" aria-hidden="true">
      <path
        d="M16 3c1.8 4.2 4.6 6.4 7.4 8.4 2.2 1.6 3.6 3.9 3.6 6.6A11 11 0 0 1 16 29 11 11 0 0 1 5 18c0-2.7 1.4-5 3.6-6.6C11.4 9.4 14.2 7.2 16 3Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M16 3c1.8 4.2 4.6 6.4 7.4 8.4 2.2 1.6 3.6 3.9 3.6 6.6A11 11 0 0 1 16 29 11 11 0 0 1 5 18c0-2.7 1.4-5 3.6-6.6C11.4 9.4 14.2 7.2 16 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
