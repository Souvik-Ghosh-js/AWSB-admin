'use client';

import Link from 'next/link';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { money, relative } from '@/lib/format';
import { CardSkeleton, EmptyState, ErrorBox, PageHeader, StatusPill } from '@/components/ui';
import type { Dashboard } from '@/lib/types';

/**
 * Morning check: what came in, what needs doing, what is running out.
 *
 * Ordered by urgency rather than by category — anything needing action today
 * sits above the revenue figures, because a number you cannot act on is not
 * the reason you opened the app.
 */
export default function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dashboard>((t) => api.dashboard(t));

  if (loading) {
    return (
      <>
        <PageHeader title="Today" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} rows={1} />
          ))}
        </div>
        <div className="mt-6">
          <CardSkeleton rows={4} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Today" />
        <ErrorBox message={error} onRetry={reload} />
      </>
    );
  }

  if (!data) return null;

  const needsAction =
    (data.ordersByStatus.confirmed ?? 0) +
    (data.ordersByStatus.packed ?? 0);
  const inTransit = data.ordersByStatus.shipped ?? 0;

  return (
    <>
      <PageHeader
        title="Today"
        subtitle="What needs your attention, then how the shop is doing."
      />

      {/* -------------------------------------------------- needs action */}
      {needsAction > 0 || inTransit > 0 || data.lowStock.length > 0 ? (
        <section className="mb-6">
          <h2 className="ad-eyebrow mb-3">Needs attention</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {needsAction > 0 ? (
              <Link
                href="/orders?status=confirmed"
                className="ad-card flex items-center gap-4 p-4 transition-colors hover:bg-[color:var(--color-surface-hover)]"
              >
                <span className="ad-num text-2xl font-semibold text-[color:var(--color-warn)]">
                  {needsAction}
                </span>
                <span className="text-sm">
                  {needsAction === 1 ? 'order to ship' : 'orders to ship'}
                  <span className="block text-xs text-[color:var(--color-muted)]">Paid and waiting</span>
                </span>
              </Link>
            ) : null}

            {inTransit > 0 ? (
              <Link
                href="/orders?status=shipped"
                className="ad-card flex items-center gap-4 p-4 transition-colors hover:bg-[color:var(--color-surface-hover)]"
              >
                <span className="ad-num text-2xl font-semibold text-[color:var(--color-info)]">
                  {inTransit}
                </span>
                <span className="text-sm">
                  in transit
                  <span className="block text-xs text-[color:var(--color-muted)]">Mark delivered when they arrive</span>
                </span>
              </Link>
            ) : null}

            {data.lowStock.length > 0 ? (
              <Link
                href="/inventory"
                className="ad-card flex items-center gap-4 p-4 transition-colors hover:bg-[color:var(--color-surface-hover)]"
              >
                <span className="ad-num text-2xl font-semibold text-[color:var(--color-danger)]">
                  {data.lowStock.length}
                </span>
                <span className="text-sm">
                  running low
                  <span className="block text-xs text-[color:var(--color-muted)]">Restock soon</span>
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------- revenue */}
      <section>
        <h2 className="ad-eyebrow mb-3">Revenue</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Today" window={data.today} />
          <Stat label="Last 7 days" window={data.last7Days} />
          <Stat label="Last 30 days" window={data.last30Days} />
          <Stat label="All time" window={data.allTime} />
        </div>
        <p className="ad-hint mt-2">Paid orders only. Cancelled and unpaid orders are excluded.</p>
      </section>

      {/* ------------------------------------------------ recent orders */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="ad-eyebrow">Recent orders</h2>
          <Link href="/orders" className="ad-link text-xs">
            See all
          </Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            message="When a customer pays, the order appears here and you will get an email."
          />
        ) : (
          <div className="ad-card overflow-hidden">
            <ul className="ad-divide">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[color:var(--color-surface-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="ad-mono text-sm font-medium">{o.orderNumber}</p>
                      <p className="truncate text-xs text-[color:var(--color-muted)]">
                        {o.customerName || 'Customer'} · {relative(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="ad-money text-sm">{money(o.totalPaise, { compact: true })}</span>
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
        <section className="mt-8">
          <h2 className="ad-eyebrow mb-3">Best sellers</h2>
          <div className="ad-card overflow-hidden">
            <ul className="ad-divide">
              {data.topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3 px-4 py-3">
                  <span className="ad-num w-5 shrink-0 text-sm text-[color:var(--color-muted)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <span className="ad-num shrink-0 text-xs text-[color:var(--color-muted)]">
                    {p.qtySold} sold
                  </span>
                  <span className="ad-money shrink-0 text-sm">
                    {money(p.revenuePaise, { compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------- queues */}
      {data.pendingReviewCount > 0 || data.newFeedbackCount > 0 ? (
        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          {data.pendingReviewCount > 0 ? (
            <Link href="/reviews" className="ad-card p-4 hover:bg-[color:var(--color-surface-hover)]">
              <p className="text-sm font-medium">
                {data.pendingReviewCount} review{data.pendingReviewCount === 1 ? '' : 's'} to moderate
              </p>
              <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                Nothing shows on the shop until you approve it
              </p>
            </Link>
          ) : null}
          {data.newFeedbackCount > 0 ? (
            <Link href="/feedback" className="ad-card p-4 hover:bg-[color:var(--color-surface-hover)]">
              <p className="text-sm font-medium">
                {data.newFeedbackCount} new message{data.newFeedbackCount === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs text-[color:var(--color-muted)]">From the contact form</p>
            </Link>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function Stat({ label, window }: { label: string; window: { revenuePaise: number; orderCount: number } }) {
  return (
    <div className="ad-card p-4">
      <p className="ad-eyebrow">{label}</p>
      <p className="ad-money ad-num mt-2 text-xl sm:text-2xl">
        {money(window.revenuePaise, { compact: true })}
      </p>
      <p className="mt-1 text-xs text-[color:var(--color-muted)]">
        {window.orderCount} {window.orderCount === 1 ? 'order' : 'orders'}
      </p>
    </div>
  );
}
