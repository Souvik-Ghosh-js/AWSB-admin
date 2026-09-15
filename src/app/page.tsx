'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { AdminCard, AdminError } from '@/components/admin/AdminShell';
import { LineSkeleton, StatusBadge } from '@/components/ui';
import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { formatDateTime, formatPaise } from '@/lib/format';
import { mockDashboard } from '@/lib/mock-data';
import type { AdminDashboard } from '@/lib/types';

/**
 * Dashboard.
 *
 * Built around what the person opening it needs to DO, not around charts.
 * The first version was four revenue tiles and two lists — on a shop with no
 * orders yet that rendered as four "₹0" boxes and "Nothing sold yet", with no
 * way to add a product from the page at all. The owner's first question was
 * "where do I add products?", which is the question this layout answers first.
 *
 *   1. Actions — add a product, pack orders, adjust stock, make a coupon.
 *   2. Getting started — shown only until the first order, then gone.
 *   3. Numbers — today / week / month / all time.
 *   4. Attention — low stock, pending reviews, unread feedback.
 *   5. Recent orders and top sellers.
 */
export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const user = getUser();

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

  const toPack = (data?.ordersByStatus?.confirmed ?? 0) + (data?.ordersByStatus?.packed ?? 0);
  const toShip = data?.ordersByStatus?.packed ?? 0;
  const isNewShop = !!data && data.allTime.orderCount === 0;
  const attentionCount =
    (data?.lowStock.length ?? 0) + (data?.pendingReviewCount ?? 0) + (data?.newFeedbackCount ?? 0);

  return (
    <div>
      {/* ------------------------------------------------------- header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="aw-eyebrow aw-eyebrow-accent">{greeting()}</p>
          <h1 className="mt-1.5 text-2xl sm:text-3xl">
            {user?.fullName ? firstName(user.fullName) : 'Dashboard'}
          </h1>
          <p className="mt-1.5 text-sm text-soft">
            {loading
              ? 'Loading today’s numbers…'
              : isNewShop
                ? 'The shop is set up. Add your first fragrance and it goes live.'
                : toPack > 0
                  ? `${toPack} ${toPack === 1 ? 'order needs' : 'orders need'} packing.`
                  : 'Nothing is waiting on you right now.'}
          </p>
        </div>

        {can(user, 'products.edit') ? (
          <Link href="/products/new" className="aw-btn aw-btn-primary">
            <PlusIcon />
            Add product
          </Link>
        ) : null}
      </div>

      <AdminError message={error} />

      {/* ------------------------------------------------ quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Action
          href="/products/new"
          label="Add a product"
          hint="Name, sizes, prices, photos"
          icon={<PlusIcon />}
          primary
          hidden={!can(user, 'products.edit')}
        />
        <Action
          href="/orders?status=confirmed"
          label="Pack orders"
          hint={loading ? '…' : toPack === 0 ? 'None waiting' : `${toPack} waiting`}
          icon={<BoxIcon />}
          count={toPack}
        />
        <Action
          href="/inventory"
          label="Adjust stock"
          hint={
            loading
              ? '…'
              : data && data.lowStock.length > 0
                ? `${data.lowStock.length} running low`
                : 'All sizes stocked'
          }
          icon={<StockIcon />}
          count={data?.lowStock.length ?? 0}
          warn
        />
        <Action
          href="/coupons"
          label="Coupons"
          hint="Discount codes"
          icon={<TagIcon />}
          hidden={!can(user, 'coupons.edit')}
        />
      </div>

      {loading ? (
        <div className="mt-6 space-y-4">
          <LineSkeleton className="h-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <LineSkeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      ) : !data ? null : (
        <>
          {/* --------------------------------------------- getting started */}
          {isNewShop ? <GettingStarted hasLowStock={data.lowStock.length > 0} /> : null}

          {/* --------------------------------------------------- numbers */}
          <section className="mt-8">
            <SectionLabel>Sales</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Tile label="Today" tile={data.today} accent />
              <Tile label="Last 7 days" tile={data.last7Days} />
              <Tile label="Last 30 days" tile={data.last30Days} />
              <Tile label="All time" tile={data.allTime} />
            </div>
          </section>

          {/* ------------------------------------------- needs attention */}
          {attentionCount > 0 ? (
            <section className="mt-8">
              <SectionLabel count={attentionCount}>Needs attention</SectionLabel>
              <div className="mt-3 grid gap-4 lg:grid-cols-3">
                {data.lowStock.length > 0 ? (
                  <AdminCard
                    title="Running low"
                    className="lg:col-span-2"
                    action={<CardLink href="/inventory">Inventory</CardLink>}
                  >
                    <ul className="divide-y divide-line">
                      {data.lowStock.slice(0, 6).map((row) => (
                        <li
                          key={row.variantId}
                          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <Link
                              href={`/products/${row.productId}`}
                              className="block truncate text-[0.9375rem] font-medium text-ink transition-colors hover:text-brand"
                            >
                              {row.productName}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted">
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
                            {row.stockQty === 0 ? 'Sold out' : `${row.stockQty} left`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AdminCard>
                ) : null}

                <AdminCard title="To review">
                  <ul className="divide-y divide-line">
                    <AttentionRow
                      href="/reviews?status=pending"
                      label="Reviews awaiting moderation"
                      count={data.pendingReviewCount}
                    />
                    <AttentionRow
                      href="/feedback"
                      label="Unread feedback"
                      count={data.newFeedbackCount}
                    />
                    <AttentionRow
                      href="/orders?status=packed"
                      label="Packed, not yet shipped"
                      count={toShip}
                    />
                  </ul>
                </AdminCard>
              </div>
            </section>
          ) : null}

          {/* ------------------------------------ recent orders + top sellers */}
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <AdminCard
              title="Recent orders"
              action={<CardLink href="/orders">All orders</CardLink>}
            >
              {data.recentOrders.length === 0 ? (
                <Empty
                  title="No orders yet"
                  body="The first one shows up here the moment a customer pays."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentOrders.slice(0, 6).map((order) => (
                    <li key={order.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/orders/${order.id}`}
                        className="group flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="aw-tabular text-[0.9375rem] font-medium text-ink transition-colors group-hover:text-brand">
                            {order.orderNumber}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-soft">
                            {order.shipFullName} · {order.shipCity}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatDateTime(order.placedAt ?? order.createdAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="aw-price text-base">
                            {formatPaise(order.totalPaise, { compact: true })}
                          </p>
                          <div className="mt-1.5">
                            <StatusBadge status={order.status} />
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>

            <AdminCard
              title="Top fragrances"
              action={<CardLink href="/products">All products</CardLink>}
            >
              {data.topProducts.length === 0 ? (
                <Empty
                  title="Nothing sold yet"
                  body="Once orders come in, the best sellers of the last 30 days rank here."
                  action={
                    can(user, 'products.edit') ? (
                      <Link href="/products/new" className="aw-btn aw-btn-outline aw-btn-sm">
                        Add a product
                      </Link>
                    ) : null
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {data.topProducts.map((product, i) => (
                    <li
                      key={`${product.productId}-${product.slug}`}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="aw-display w-6 shrink-0 text-lg text-accent">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={product.productId ? `/products/${product.productId}` : '/products'}
                            className="block truncate text-[0.9375rem] font-medium text-ink transition-colors hover:text-brand"
                          >
                            {product.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted">
                            {product.unitsSold} sold
                          </p>
                        </div>
                      </div>
                      <span className="aw-price shrink-0 text-base">
                        {formatPaise(product.revenuePaise, { compact: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          </section>
        </>
      )}
    </div>
  );
}

/* ================================================================ pieces */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}

function SectionLabel({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <h2 className="text-lg">{children}</h2>
      {count != null && count > 0 ? (
        <span className="aw-badge bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[#8a6c26]">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-brand-soft underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

/**
 * A large tappable action. On a phone these are the whole dashboard — the
 * numbers scroll below — so they are 2-up and generous.
 */
function Action({
  href,
  label,
  hint,
  icon,
  count,
  primary = false,
  warn = false,
  hidden = false,
}: {
  href: string;
  label: string;
  hint: string;
  icon: ReactNode;
  count?: number;
  primary?: boolean;
  warn?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return null;

  const hot = !primary && !!count && count > 0;

  return (
    <Link
      href={href}
      className={`aw-tile group flex min-h-[7.5rem] flex-col justify-between p-4 sm:p-5 ${
        primary ? 'border-brand bg-brand text-[#fbf9f3]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-md ${
            primary
              ? 'bg-white/12 text-[#fbf9f3]'
              : hot && warn
                ? 'bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] text-[#8a6c26]'
                : hot
                  ? 'bg-[color-mix(in_srgb,var(--color-brand)_10%,transparent)] text-brand'
                  : 'bg-surface-alt text-soft'
          }`}
        >
          {icon}
        </span>
        {hot ? (
          <span
            className={`aw-display text-2xl leading-none ${warn ? 'text-[#8a6c26]' : 'text-brand'}`}
          >
            {count}
          </span>
        ) : null}
      </div>
      <div>
        {/* Explicit colour on the primary label. The <a> is caught by the
            unlayered `a { color: inherit }` reset, so a bare <p> inside it
            inherits body ink and rendered dark-green-on-dark-green. */}
        <p className={`text-[0.9375rem] font-semibold ${primary ? 'text-[#fbf9f3]' : 'text-ink'}`}>
          {label}
        </p>
        <p className={`mt-0.5 text-xs ${primary ? 'text-[#fbf9f3]/75' : 'text-muted'}`}>{hint}</p>
      </div>
    </Link>
  );
}

function Tile({
  label,
  tile,
  accent = false,
}: {
  label: string;
  tile: { revenuePaise: number; orderCount: number };
  accent?: boolean;
}) {
  return (
    <div className={`aw-card p-4 sm:p-5 ${accent ? 'border-accent-bright/40' : ''}`}>
      <p className="aw-eyebrow">{label}</p>
      <p className="aw-price mt-3 text-2xl leading-none sm:text-3xl">
        {formatPaise(tile.revenuePaise, { compact: true })}
      </p>
      <p className="mt-2 text-xs text-muted">
        {tile.orderCount === 0
          ? 'No orders'
          : `${tile.orderCount} ${tile.orderCount === 1 ? 'order' : 'orders'}`}
      </p>
    </div>
  );
}

function AttentionRow({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <Link href={href} className="group flex items-center justify-between gap-3">
        <span
          className={`text-[0.9375rem] transition-colors group-hover:text-brand ${
            count > 0 ? 'text-ink' : 'text-muted'
          }`}
        >
          {label}
        </span>
        <span
          className={`aw-tabular text-[0.9375rem] font-semibold ${
            count > 0 ? 'text-brand' : 'text-muted'
          }`}
        >
          {count}
        </span>
      </Link>
    </li>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="px-2 py-8 text-center">
      <p className="text-[0.9375rem] font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Shown until the first order. A new owner should not be looking at four
 * "₹0" boxes wondering what to do — this is the order to do it in.
 */
function GettingStarted({ hasLowStock }: { hasLowStock: boolean }) {
  const steps = [
    {
      href: '/products/new',
      title: 'Add your first fragrance',
      body: 'Name, story, scent notes, and the 3 / 6 / 12 ml prices. It appears on the shop as soon as it is saved as active.',
    },
    {
      href: '/inventory',
      title: 'Set the stock for each size',
      body: hasLowStock
        ? 'Some sizes are already at or below their low-stock threshold.'
        : 'Each size has its own count. Sold-out sizes stay visible but cannot be bought.',
    },
    {
      href: '/couriers',
      title: 'Check the courier list',
      body: 'These are the carriers you can pick when shipping. Tracking links go to customers by email.',
    },
    {
      href: '/coupons',
      title: 'Create a launch coupon',
      body: 'Optional. A percentage or flat discount, with a minimum order and an expiry.',
    },
  ];

  return (
    <section className="mt-8">
      <SectionLabel>Getting started</SectionLabel>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.href}>
            <Link href={step.href} className="aw-tile group flex h-full gap-4 p-4 sm:p-5">
              <span className="aw-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-base text-accent">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-semibold text-ink transition-colors group-hover:text-brand">
                  {step.title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-soft">{step.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ icons */

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5v-7zM3 6.5 10 10l7-3.5M10 10v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4 16V9M8 16V5M12 16v-4M16 16V7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M3 3h6.5L17 10.5 10.5 17 3 9.5V3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="1.3" fill="currentColor" />
    </svg>
  );
}
