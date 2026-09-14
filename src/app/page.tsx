'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AdminCard, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton, StatusBadge } from '@/components/ui';
import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { getToken } from '@/lib/admin-auth';
import { formatDateTime, formatPaise } from '@/lib/format';
import { mockDashboard } from '@/lib/mock-data';
import type { AdminDashboard } from '@/lib/types';

/**
 * Dashboard: revenue tiles, order counts, top products and low-stock warnings.
 *
 * Low stock is given real prominence rather than being buried in a report —
 * the whole point of the per-variant `low_stock_threshold` is that someone
 * acts on it before a size sells out.
 */
export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const token = getToken();
      if (!token) return;

      try {
        setData(await adminApi.dashboard(token));
      } catch (err) {
        if (USE_MOCKS || (err instanceof ApiError && err.isNetworkError)) {
          setData(mockDashboard);
        } else {
          setError(
            err instanceof ApiError ? err.friendlyMessage : 'Could not load the dashboard.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div>
        <AdminHeading title="Dashboard" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <LineSkeleton key={i} className="h-28" />
          ))}
        </div>
        <LineSkeleton className="mt-6 h-64" />
      </div>
    );
  }

  return (
    <div>
      <AdminHeading
        title="Dashboard"
        description="Revenue, orders and anything that needs your attention today."
      />

      <AdminError message={error} />

      {!data ? null : (
        <>
          {/* -------------------------------------------- revenue tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Today" tile={data.today} />
            <Tile label="Last 7 days" tile={data.last7Days} />
            <Tile label="Last 30 days" tile={data.last30Days} />
            <Tile label="All time" tile={data.allTime} />
          </div>

          {/* ------------------------------------------ needs attention */}
          {(data.lowStock.length > 0 ||
            data.pendingReviewCount > 0 ||
            data.newFeedbackCount > 0) && (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {data.lowStock.length > 0 ? (
                <AdminCard
                  title="Low stock"
                  className="lg:col-span-2"
                  action={
                    <Link
                      href="/inventory"
                      className="text-xs text-brand-soft underline underline-offset-4"
                    >
                      Inventory
                    </Link>
                  }
                >
                  <ul className="divide-y divide-line">
                    {data.lowStock.map((row) => (
                      <li
                        key={row.variantId}
                        className="flex items-center justify-between gap-4 py-2.5 first:pt-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/products/${row.productId}`}
                            className="truncate text-[0.875rem] transition-colors hover:text-brand"
                          >
                            {row.productName}
                          </Link>
                          <p className="text-xs text-muted">
                            {row.sizeMl} ml · {row.sku}
                          </p>
                        </div>
                        <span
                          className={`aw-badge shrink-0 ${
                            row.stockQty === 0
                              ? 'bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-danger'
                              : 'bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[#8a6c26]'
                          }`}
                        >
                          {row.stockQty === 0 ? 'Out of stock' : `${row.stockQty} left`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AdminCard>
              ) : null}

              <AdminCard title="To action">
                <ul className="space-y-3">
                  <li className="flex items-center justify-between gap-3">
                    <Link
                      href="/reviews?status=pending"
                      className="text-[0.875rem] transition-colors hover:text-brand"
                    >
                      Reviews awaiting moderation
                    </Link>
                    <span className="aw-tabular text-[0.875rem] font-medium">
                      {data.pendingReviewCount}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <Link
                      href="/feedback"
                      className="text-[0.875rem] transition-colors hover:text-brand"
                    >
                      Unread feedback
                    </Link>
                    <span className="aw-tabular text-[0.875rem] font-medium">
                      {data.newFeedbackCount}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <Link
                      href="/orders?status=confirmed"
                      className="text-[0.875rem] transition-colors hover:text-brand"
                    >
                      Orders to pack
                    </Link>
                    <span className="aw-tabular text-[0.875rem] font-medium">
                      {(data.ordersByStatus?.confirmed ?? 0) +
                        (data.ordersByStatus?.packed ?? 0)}
                    </span>
                  </li>
                </ul>
              </AdminCard>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* ------------------------------------------ recent orders */}
            <AdminCard
              title="Recent orders"
              action={
                <Link
                  href="/orders"
                  className="text-xs text-brand-soft underline underline-offset-4"
                >
                  All orders
                </Link>
              }
            >
              {data.recentOrders.length === 0 ? (
                <p className="py-6 text-center text-[0.875rem] text-muted">
                  No orders yet.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentOrders.slice(0, 6).map((order) => (
                    <li key={order.id} className="py-3 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-[0.875rem] transition-colors hover:text-brand"
                          >
                            {order.orderNumber}
                          </Link>
                          <p className="truncate text-xs text-muted">
                            {order.shipFullName} · {order.shipCity}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatDateTime(order.placedAt ?? order.createdAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="aw-tabular text-[0.875rem]">
                            {formatPaise(order.totalPaise, { compact: true })}
                          </p>
                          <div className="mt-1">
                            <StatusBadge status={order.status} />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>

            {/* ------------------------------------------ top products */}
            <AdminCard title="Top fragrances">
              {data.topProducts.length === 0 ? (
                <p className="py-6 text-center text-[0.875rem] text-muted">
                  Nothing sold yet.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.topProducts.map((product, i) => (
                    <li
                      key={product.productId}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="aw-tabular w-5 shrink-0 text-xs text-muted">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/product/${product.slug}`}
                            className="truncate text-[0.875rem] transition-colors hover:text-brand"
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-muted">
                            {product.unitsSold} sold
                          </p>
                        </div>
                      </div>
                      <span className="aw-tabular shrink-0 text-[0.875rem]">
                        {formatPaise(product.revenuePaise, { compact: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  tile,
}: {
  label: string;
  tile: { revenuePaise: number; orderCount: number };
}) {
  return (
    <div className="aw-card p-5">
      <p className="aw-eyebrow">{label}</p>
      <p className="aw-price mt-3 text-2xl leading-none">
        {formatPaise(tile.revenuePaise, { compact: true })}
      </p>
      <p className="mt-2 text-xs text-muted">
        {tile.orderCount} {tile.orderCount === 1 ? 'order' : 'orders'}
      </p>
    </div>
  );
}
