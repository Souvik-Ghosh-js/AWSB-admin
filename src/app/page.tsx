'use client';

import Link from 'next/link';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { money, relative } from '@/lib/format';
import { CardSkeleton, EmptyState, ErrorBox, StatusPill } from '@/components/ui';
import type { Dashboard } from '@/lib/types';

/**
 * Morning check — big numbers, big actions.
 *
 * Ordered by urgency: things needing action today sit above revenue, because a
 * figure you cannot act on is not why you opened the app. Today's revenue gets
 * the dark hero card; the rest are white.
 */
export default function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dashboard>((t) => api.dashboard(t));

  if (loading) {
    return (
      <>
        <Heading />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} rows={1} />)}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Heading />
        <ErrorBox message={error} onRetry={reload} />
      </>
    );
  }

  if (!data) return null;

  const toShip = (data.ordersByStatus.confirmed ?? 0) + (data.ordersByStatus.packed ?? 0);
  const inTransit = data.ordersByStatus.shipped ?? 0;
  const low = data.lowStock.length;
  const anything = toShip > 0 || inTransit > 0 || low > 0;

  return (
    <>
      <Heading />

      {/* -------------------------------------------------- needs action */}
      <section className="mb-8">
        <p className="ad-eyebrow mb-3">Needs attention</p>
        {anything ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {toShip > 0 ? (
              <Action
                href="/orders?status=confirmed"
                n={toShip}
                label={toShip === 1 ? 'order to ship' : 'orders to ship'}
                sub="Paid and waiting"
                tone="warn"
              />
            ) : null}
            {inTransit > 0 ? (
              <Action
                href="/orders?status=shipped"
                n={inTransit}
                label="in transit"
                sub="Mark delivered on arrival"
                tone="info"
              />
            ) : null}
            {low > 0 ? (
              <Action href="/inventory" n={low} label="running low" sub="Restock soon" tone="danger" />
            ) : null}
          </div>
        ) : (
          <div className="ad-card flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-ok)] text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-lg font-bold">All clear</p>
              <p className="text-sm text-[color:var(--color-muted)]">Nothing to ship, nothing running low.</p>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- revenue */}
      <section>
        <p className="ad-eyebrow mb-3">Revenue · paid orders only</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Today" window={data.today} hero />
          <Stat label="Last 7 days" window={data.last7Days} />
          <Stat label="Last 30 days" window={data.last30Days} />
          <Stat label="All time" window={data.allTime} />
        </div>
      </section>

      {/* ------------------------------------------------ recent orders */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <p className="ad-eyebrow">Recent orders</p>
          <Link href="/orders" className="ad-link text-sm">See all</Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            message="When a customer pays, the order appears here and you get an email."
          />
        ) : (
          <div className="ad-card overflow-hidden">
            <ul className="ad-divide">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[color:var(--color-surface-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="ad-mono text-base">{o.orderNumber}</p>
                      <p className="truncate text-sm text-[color:var(--color-muted)]">
                        {o.customerName || 'Customer'} · {relative(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="ad-money text-lg">{money(o.totalPaise, { compact: true })}</span>
                      <StatusPill status={o.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ------------------------------------------------- top products */}
      {data.topProducts.length > 0 ? (
        <section className="mt-10">
          <p className="ad-eyebrow mb-3">Best sellers</p>
          <div className="ad-card overflow-hidden">
            <ul className="ad-divide">
              {data.topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-4 px-5 py-4">
                  <span className="ad-figure w-8 shrink-0 text-2xl text-[color:var(--color-accent-deep)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base font-semibold">{p.name}</span>
                  <span className="ad-num shrink-0 text-sm text-[color:var(--color-muted)]">{p.qtySold} sold</span>
                  <span className="ad-money shrink-0 text-base">{money(p.revenuePaise, { compact: true })}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------- queues */}
      {data.pendingReviewCount > 0 || data.newFeedbackCount > 0 ? (
        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          {data.pendingReviewCount > 0 ? (
            <Link href="/reviews" className="ad-card flex items-center gap-4 p-5 hover:bg-[color:var(--color-surface-hover)]">
              <span className="ad-figure text-3xl text-[color:var(--color-brand)]">{data.pendingReviewCount}</span>
              <span>
                <span className="block text-base font-bold">review{data.pendingReviewCount === 1 ? '' : 's'} to approve</span>
                <span className="block text-sm text-[color:var(--color-muted)]">Hidden from the shop until you do</span>
              </span>
            </Link>
          ) : null}
          {data.newFeedbackCount > 0 ? (
            <Link href="/feedback" className="ad-card flex items-center gap-4 p-5 hover:bg-[color:var(--color-surface-hover)]">
              <span className="ad-figure text-3xl text-[color:var(--color-brand)]">{data.newFeedbackCount}</span>
              <span>
                <span className="block text-base font-bold">new message{data.newFeedbackCount === 1 ? '' : 's'}</span>
                <span className="block text-sm text-[color:var(--color-muted)]">From the contact form</span>
              </span>
            </Link>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function Heading() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="mb-7">
      <p className="ad-eyebrow text-[color:var(--color-accent-deep)]">{greeting}</p>
      <h1 className="mt-1">Today at the shop</h1>
    </div>
  );
}

function Action({
  href, n, label, sub, tone,
}: {
  href: string; n: number; label: string; sub: string; tone: 'warn' | 'info' | 'danger';
}) {
  const bg = { warn: 'var(--color-warn)', info: 'var(--color-info)', danger: 'var(--color-danger)' }[tone];
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-[var(--radius-md)] p-5 text-white shadow-[var(--shadow-raised)] transition-transform active:scale-[0.99]"
      style={{ background: bg }}
    >
      <span className="ad-figure text-5xl">{n}</span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-tight">{label}</span>
        <span className="block text-sm opacity-80">{sub}</span>
      </span>
      <svg viewBox="0 0 24 24" className="ml-auto h-6 w-6 shrink-0 opacity-70" fill="none" aria-hidden="true">
        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function Stat({
  label, window, hero = false,
}: {
  label: string; window: { revenuePaise: number; orderCount: number }; hero?: boolean;
}) {
  return (
    <div className={`${hero ? 'ad-card-hero col-span-2 lg:col-span-1' : 'ad-card'} p-5`}>
      <p className="ad-eyebrow">{label}</p>
      <p className={`ad-figure ad-money mt-3 ${hero ? 'text-4xl sm:text-5xl' : 'text-3xl'}`}>
        {money(window.revenuePaise, { compact: true })}
      </p>
      <p className={`mt-2 text-sm font-semibold ${hero ? 'text-[color:var(--color-on-chrome-dim)]' : 'text-[color:var(--color-muted)]'}`}>
        {window.orderCount} {window.orderCount === 1 ? 'order' : 'orders'}
      </p>
    </div>
  );
}
