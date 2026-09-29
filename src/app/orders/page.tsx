'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  // Not a real order status — checkouts the sweeper auto-cancelled for
  // non-payment. Distinct from "Cancelled", which also includes cancels the
  // customer or an admin chose deliberately.
  { value: 'abandoned', label: 'Abandoned' },
];

export default function OrdersPage() {
  return (
    <Suspense fallback={<CardSkeleton rows={5} />}>
      <OrdersInner />
    </Suspense>
  );
}

function OrdersInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openBulkPrint(kind: 'labels' | 'invoices') {
    if (selected.size === 0) return;
    // No noopener/noreferrer: this is a same-origin admin page, and dropping
    // the opener relationship stops the new tab's sessionStorage from
    // cloning the admin JWT, which sent it straight to a login screen.
    window.open(`/orders/print/${kind}?ids=${[...selected].join(',')}`, '_blank');
  }

  const abandoned = status === 'abandoned';
  const { data, error, loading, reload } = useApi<Page<OrderSummary>>(
    (t) =>
      api.orders(t, {
        page,
        limit: 20,
        status: abandoned ? undefined : status || undefined,
        abandoned: abandoned || undefined,
        q: query || undefined,
      }),
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

      {selected.size > 0 ? (
        <div className="ad-card mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="text-sm font-semibold">
            {selected.size} order{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openBulkPrint('invoices')} className="ad-btn ad-btn-outline ad-btn-sm">
              Print invoices
            </button>
            <button type="button" onClick={() => openBulkPrint('labels')} className="ad-btn ad-btn-outline ad-btn-sm">
              Print labels
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="ad-btn ad-btn-outline ad-btn-sm">
              Clear
            </button>
          </div>
        </div>
      ) : null}

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
              <div key={o.id} className="ad-card flex items-start gap-2 p-4">
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggleSelected(o.id)}
                  aria-label={`Select order ${o.orderNumber}`}
                  className="mt-1 h-5 w-5 shrink-0 accent-[color:var(--color-brand)]"
                />
                <Link href={`/orders/${o.id}`} className="block min-w-0 flex-1">
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
              </div>
            ))}
          </div>

          <div className="ad-card hidden overflow-hidden lg:block">
            <div className="ad-scroll-x">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={data.items.length > 0 && data.items.every((o) => selected.has(o.id))}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const o of data.items) {
                              if (e.target.checked) next.add(o.id);
                              else next.delete(o.id);
                            }
                            return next;
                          });
                        }}
                        aria-label="Select all orders on this page"
                        className="h-5 w-5 accent-[color:var(--color-brand)]"
                      />
                    </th>
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
                    <tr
                      key={o.id}
                      className="cursor-pointer hover:bg-[color:var(--color-surface-alt)]"
                      onClick={() => router.push(`/orders/${o.id}`)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(o.id)}
                          onChange={() => toggleSelected(o.id)}
                          aria-label={`Select order ${o.orderNumber}`}
                          className="h-5 w-5 accent-[color:var(--color-brand)]"
                        />
                      </td>
                      <td>
                        <Link
                          href={`/orders/${o.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ad-mono ad-link font-medium"
                        >
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
