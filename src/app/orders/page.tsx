'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton, StatusBadge } from '@/components/ui';
import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { getToken } from '@/lib/admin-auth';
import { formatDateTime, formatPaise } from '@/lib/format';
import { mockAdminOrders } from '@/lib/mock-data';
import type { AdminOrderSummary, OrderStatus } from '@/lib/types';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderSummary[] | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = getToken();
      if (!token) return;

      setLoading(true);
      setError(null);

      try {
        const result = await adminApi.orders(token, {
          ...(status ? { status } : {}),
          ...(search ? { q: search } : {}),
          limit: 50,
        });
        if (!cancelled) setOrders(result.items ?? []);
      } catch (err) {
        if (cancelled) return;
        if (USE_MOCKS || (err instanceof ApiError && err.isNetworkError)) {
          setOrders(
            mockAdminOrders.filter((o) => (status ? o.status === status : true))
          );
        } else {
          setError(
            err instanceof ApiError ? err.friendlyMessage : 'Could not load orders.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, search]);

  return (
    <div>
      <AdminHeading title="Orders" description="Every order, newest first." />

      <AdminError message={error} />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:pb-0">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatus(filter.value)}
              aria-pressed={status === filter.value}
              className={`shrink-0 border px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors ${
                status === filter.value
                  ? 'border-brand bg-brand text-[#f7f4ea]'
                  : 'border-line-strong text-ink hover:border-brand'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
          role="search"
        >
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            id="order-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order number, name, email or phone"
            className="aw-field w-full lg:w-72"
          />
        </form>
      </div>

      <div className="aw-card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <LineSkeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <AdminEmpty message="No orders match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-alt">
                  <Th>Order</Th>
                  <Th>Placed</Th>
                  <Th>Customer</Th>
                  <Th>Destination</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-line transition-colors last:border-0 hover:bg-surface-alt"
                  >
                    <Td>
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-brand underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted">
                        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      </p>
                    </Td>
                    <Td className="text-xs text-muted">
                      {formatDateTime(order.placedAt ?? order.createdAt)}
                    </Td>
                    <Td>{order.shipFullName}</Td>
                    <Td className="text-xs text-muted">
                      {order.shipCity} {order.shipPincode}
                      <br />
                      <span className="text-[0.6875rem]">
                        {order.shipZone === 'kolkata' ? 'Kolkata' : 'Rest of India'}
                      </span>
                    </Td>
                    <Td className="aw-tabular text-right">
                      {formatPaise(order.totalPaise, { compact: true })}
                    </Td>
                    <Td>
                      <StatusBadge status={order.status as OrderStatus} />
                    </Td>
                    <Td>
                      <StatusBadge status={order.paymentStatus} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={`aw-eyebrow px-4 py-3 text-[0.5625rem] ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-[0.8125rem] align-top ${className}`}>{children}</td>;
}
