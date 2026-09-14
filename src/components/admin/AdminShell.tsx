'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { clearSession, getToken, getUser, subscribeToSession } from '@/lib/admin-auth';
import { LogoMark } from '@/components/Logo';
import type { AdminUser } from '@/lib/types';

/**
 * Admin chrome + the client-side auth gate.
 *
 * The gate here is a UX affordance, NOT a security boundary: it keeps a
 * signed-out person from staring at empty tables. Every admin endpoint
 * re-checks the JWT and the role server-side, and that check is the real one.
 */

const NAV: { href: string; label: string; group: string }[] = [
  // Routes are relative to this app's own root. The panel is served from
  // admin.<domain>, so there is no /admin prefix — that belonged to the old
  // layout where the panel lived inside the storefront.
  { href: '/', label: 'Dashboard', group: 'Overview' },
  { href: '/orders', label: 'Orders', group: 'Selling' },
  { href: '/products', label: 'Products', group: 'Selling' },
  { href: '/inventory', label: 'Inventory', group: 'Selling' },
  { href: '/coupons', label: 'Coupons', group: 'Selling' },
  { href: '/couriers', label: 'Couriers', group: 'Fulfilment' },
  { href: '/reviews', label: 'Reviews', group: 'Customers' },
  { href: '/feedback', label: 'Feedback', group: 'Customers' },
  { href: '/settings', label: 'Settings', group: 'System' },
  { href: '/users', label: 'Admin users', group: 'System' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const token = getToken();
      setUser(token ? getUser() : null);
      setChecked(true);
    };
    sync();
    return subscribeToSession(sync);
  }, []);

  // Bounce to the login screen once we know there is no session.
  useEffect(() => {
    if (checked && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [checked, user, pathname, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // The login page renders itself, without the chrome.
  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="aw-eyebrow">Checking your session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="aw-eyebrow">Redirecting to sign in…</p>
      </div>
    );
  }

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <div className="min-h-screen bg-bg lg:flex">
      {/* ------------------------------------------------------- sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto border-r border-line bg-surface transition-transform lg:static lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <LogoMark className="h-7 w-7 text-brand" />
          <div>
            <p className="font-[family-name:var(--font-display)] text-base leading-none text-brand">
              Attar World
            </p>
            <p className="aw-eyebrow mt-1 text-[0.5625rem] leading-none">Admin</p>
          </div>
        </div>

        <nav className="px-3 py-5">
          {groups.map((group) => (
            <div key={group} className="mb-5">
              <p className="aw-eyebrow mb-2 px-3 text-[0.5625rem]">{group}</p>
              <ul className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((item) => {
                  const active =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`block rounded-sm px-3 py-2 text-[0.8125rem] transition-colors ${
                          active
                            ? 'bg-[color-mix(in_srgb,var(--color-brand)_8%,transparent)] font-medium text-brand'
                            : 'text-ink hover:bg-surface-alt'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-[0.8125rem] font-medium text-ink">{user.fullName}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
          <p className="aw-eyebrow mt-1 text-[0.5625rem]">{user.role}</p>
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
            className="mt-3 text-xs text-muted underline underline-offset-4 transition-colors hover:text-danger"
          >
            Sign out
          </button>
        </div>
      </aside>

      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--color-ink)_35%,transparent)] lg:hidden"
        />
      ) : null}

      {/* ---------------------------------------------------------- main */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="flex h-9 w-9 items-center justify-center text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <span className="aw-eyebrow">Admin</span>
        </header>

        <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- shared bits */

export function AdminHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-[1.75rem]">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-[0.8125rem] text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminCard({
  title,
  children,
  action,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`aw-card p-5 sm:p-6 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Consistent inline error for admin screens. */
export function AdminError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-5 border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_6%,transparent)] px-4 py-3 text-[0.8125rem] text-ink"
    >
      {message}
    </p>
  );
}

export function AdminEmpty({ message }: { message: string }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="text-[0.875rem] text-muted">{message}</p>
    </div>
  );
}
