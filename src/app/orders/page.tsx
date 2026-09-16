'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { money, relative } from '@/lib/format';
import {
  CardSkeleton, EmptyState, ErrorBox, PageHeader, Pagination, PaymentPill, StatusPill,
} from '@/components/ui';
import type { OrderStatus, OrderSummary, Page } from '@/lib/types';

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'To ship' },
  { value: 'shipped', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'pending_payment', label: 'Unpaid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  return (
    <Suspense fallback={<CardSkeleton rows={5} />}>
      <OrdersInner />
    </Suspense>
  );
}

function OrdersInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, error, loading, reload } = useApi<Page<OrderSummary>>(
    (t) => api.orders(t, { page, limit: 20, status: status || undefined, q: query || undefined }),
    [page, status, query],
  );

  return (
    <>
      <PageHeader title="Orders" subtitle="Newest first. Tap an order to ship or cancel it." />

      {/* Horizontally scrolling filter chips — six filters do not fit across a
          390px screen, and a <select> hides the current state behind a tap. */}
      <div className="ad-scroll-x -mx-4 mb-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-2 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              aria-pressed={status === f.value}
              className={`ad-btn ad-btn-sm shrink-0 ${
                status === f.value ? 'ad-btn-primary' : 'ad-btn-outline'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
        className="mb-4 flex gap-2"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Order number, name, email or phone"
          aria-label="Search orders"
          className="ad-input"
        />
        <button type="submit" className="ad-btn ad-btn-outline shrink-0">
          Search
        </button>
      </form>

      {loading ? (
        <CardSkeleton rows={5} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={query || status ? 'No orders match' : 'No orders yet'}
          message={
            query || status
              ? 'Try a different filter or search term.'
              : 'When a customer pays, the order appears here and you get an email.'
          }
          action={
            query || status ? (
              <button
                type="button"
                onClick={() => {
                  setStatus('');
                  setQuery('');
                  setSearch('');
                }}
                className="ad-btn ad-btn-outline"
              >
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Cards on a phone, table on a desktop. A 9-column table on a 390px
              screen is unreadable however cleverly it scrolls. */}
          <div className="space-y-3 lg:hidden">
            {data.items.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="ad-card block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="ad-mono text-sm font-semibold">{o.orderNumber}</p>
                    <p className="mt-0.5 truncate text-sm">{o.shipFullName}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                      {o.shipCity} {o.shipPincode} · {relative(o.createdAt)}
                    </p>
                  </div>
                  <span className="ad-money shrink-0 text-base">
                    {money(o.totalPaise, { compact: true })}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusPill status={o.status} />
                  <PaymentPill status={o.paymentStatus} />
                  <span className="ad-pill ad-pill-muted">
                    {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="ad-card hidden overflow-hidden lg:block">
            <div className="ad-scroll-x">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Placed</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/orders/${o.id}`} className="ad-mono ad-link font-medium">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td>
                        <p className="font-medium">{o.shipFullName}</p>
                        <p className="text-xs text-[color:var(--color-muted)]">
                          {o.shipCity} {o.shipPincode}
                        </p>
                      </td>
                      <td className="text-xs text-[color:var(--color-muted)]">
                        {relative(o.createdAt)}
                      </td>
                      <td><StatusPill status={o.status as OrderStatus} /></td>
                      <td><PaymentPill status={o.paymentStatus} /></td>
                      <td className="ad-money text-right">{money(o.totalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
