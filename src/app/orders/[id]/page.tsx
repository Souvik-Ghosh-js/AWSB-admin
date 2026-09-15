'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminCard, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { ShipOrderDialog } from '@/components/admin/ShipOrderDialog';
import { LineSkeleton, StatusBadge } from '@/components/ui';
import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { formatDateTime, formatPaise, formatPhone } from '@/lib/format';
import { mockAdminOrderDetail } from '@/lib/mock-data';
import type { AdminOrderDetail } from '@/lib/types';

/**
 * Order detail, with the three actions that move an order forward:
 * Ship (courier + AWB), Mark delivered, and Cancel (which triggers a refund
 * server-side when the order was paid).
 */
export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const user = getUser();

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !Number.isFinite(id)) return;

    try {
      setOrder(await adminApi.order(token, id));
      setError(null);
    } catch (err) {
      if (USE_MOCKS || (err instanceof ApiError && err.isNetworkError)) {
        setOrder(mockAdminOrderDetail);
      } else {
        setError(
          err instanceof ApiError ? err.friendlyMessage : 'Could not load this order.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const markDelivered = async () => {
    const token = getToken();
    if (!token || !order) return;

    setBusy(true);
    setError(null);
    try {
      setOrder(await adminApi.deliverOrder(token, order.id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.friendlyMessage : 'Could not mark this delivered.'
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    const token = getToken();
    if (!token || !order) return;

    if (!cancelReason.trim()) {
      setError('Give a reason for the cancellation — it goes in the audit log.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setOrder(await adminApi.cancelOrder(token, order.id, cancelReason.trim()));
      setCancelOpen(false);
      setCancelReason('');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.friendlyMessage : 'Could not cancel this order.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div>
        <AdminHeading title="Order" />
        <LineSkeleton className="h-96" />
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <AdminHeading title="Order" />
        <AdminError message={error ?? 'Order not found.'} />
        <Link href="/orders" className="aw-btn aw-btn-outline aw-btn-sm">
          Back to orders
        </Link>
      </div>
    );
  }

  const canShip = ['confirmed', 'packed'].includes(order.status);
  const canDeliver = order.status === 'shipped';
  const canCancel = !['delivered', 'cancelled', 'refunded'].includes(order.status);

  return (
    <div>
      <AdminHeading
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.placedAt ?? order.createdAt)}`}
        action={
          <Link href="/orders" className="aw-btn aw-btn-ghost aw-btn-sm">
            ← All orders
          </Link>
        }
      />

      <AdminError message={error} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} />
        <StatusBadge status={order.paymentStatus} />
        <span className="aw-badge bg-surface-alt text-muted">
          {order.shipZone === 'kolkata' ? 'Kolkata' : 'Rest of India'}
        </span>
      </div>

      {/* ------------------------------------------------------- actions */}
      <div className="mb-6 flex flex-wrap gap-3">
        {canShip && can(user, 'orders.ship') ? (
          <button
            type="button"
            onClick={() => setShipOpen(true)}
            className="aw-btn aw-btn-primary aw-btn-sm"
          >
            Ship this order
          </button>
        ) : null}

        {canDeliver && can(user, 'orders.ship') ? (
          <button
            type="button"
            onClick={() => void markDelivered()}
            disabled={busy}
            className="aw-btn aw-btn-outline aw-btn-sm"
          >
            {busy ? 'Working…' : 'Mark delivered'}
          </button>
        ) : null}

        {canCancel && can(user, 'orders.cancel') ? (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="aw-btn aw-btn-danger aw-btn-sm"
          >
            Cancel order
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------------- items */}
        <div className="lg:col-span-2">
          <AdminCard title="Items">
            <div className="overflow-x-auto">
              <table className="aw-table">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">Product</th>
                    <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">Size</th>
                    <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">SKU</th>
                    <th scope="col" className="aw-eyebrow py-2 pr-3 text-right text-[0.5625rem]">Unit</th>
                    <th scope="col" className="aw-eyebrow py-2 pr-3 text-right text-[0.5625rem]">Qty</th>
                    <th scope="col" className="aw-eyebrow py-2 text-right text-[0.5625rem]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={`${item.sku}-${i}`} className="border-b border-line last:border-0">
                      <td className="py-3 pr-3 text-[0.8125rem]">{item.productName}</td>
                      <td data-label="Size" className="py-3 pr-3 text-[0.8125rem]">{item.sizeMl} ml</td>
                      <td data-label="SKU" className="aw-tabular py-3 pr-3 text-xs text-muted">{item.sku}</td>
                      <td data-label="Unit" className="aw-tabular py-3 pr-3 text-right text-[0.8125rem]">
                        {formatPaise(item.unitPricePaise, { compact: true })}
                      </td>
                      <td data-label="Qty" className="aw-tabular py-3 pr-3 text-right text-[0.8125rem]">
                        {item.quantity}
                      </td>
                      <td data-label="Total" className="aw-tabular py-3 text-right text-[0.8125rem]">
                        {formatPaise(item.lineTotalPaise, { compact: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="mt-5 space-y-2 border-t border-line pt-4">
              <SummaryRow label="Subtotal" value={formatPaise(order.subtotalPaise, { compact: true })} />
              {order.discountPaise > 0 ? (
                <SummaryRow
                  label={order.couponCode ? `Discount (${order.couponCode})` : 'Discount'}
                  value={`−${formatPaise(order.discountPaise, { compact: true })}`}
                />
              ) : null}
              <SummaryRow label="Shipping" value={formatPaise(order.shippingPaise, { compact: true })} />
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
                <dt className="text-[0.875rem] font-medium">Total</dt>
                <dd className="aw-price text-lg">
                  {formatPaise(order.totalPaise, { compact: true })}
                </dd>
              </div>
            </dl>
            {/* No tax row: the shop is not GST registered. */}
          </AdminCard>

          {order.customerNote ? (
            <AdminCard title="Customer note" className="mt-5">
              <p className="text-[0.8125rem] leading-relaxed text-muted">
                {order.customerNote}
              </p>
            </AdminCard>
          ) : null}
        </div>

        {/* ---------------------------------------------------- sidebar */}
        <div className="space-y-5">
          <AdminCard title="Deliver to">
            <address className="text-[0.8125rem] leading-relaxed not-italic">
              <span className="font-medium">{order.shippingAddress.fullName}</span>
              <br />
              <span className="text-muted">{order.shippingAddress.line1}</span>
              {order.shippingAddress.line2 ? (
                <>
                  <br />
                  <span className="text-muted">{order.shippingAddress.line2}</span>
                </>
              ) : null}
              {order.shippingAddress.landmark ? (
                <>
                  <br />
                  <span className="text-muted">Near {order.shippingAddress.landmark}</span>
                </>
              ) : null}
              <br />
              <span className="text-muted">
                {order.shippingAddress.city}
                {order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ''}
              </span>
              <br />
              <span className="text-muted">
                {order.shippingAddress.state} {order.shippingAddress.pincode}
              </span>
            </address>

            <div className="mt-4 space-y-1 border-t border-line pt-3">
              <p className="text-[0.8125rem]">
                <a href={`tel:+91${order.shipPhone}`} className="hover:text-brand">
                  {formatPhone(order.shipPhone)}
                </a>
                {order.shippingAddress.altPhone ? (
                  <>
                    {' · '}
                    <a
                      href={`tel:+91${order.shippingAddress.altPhone}`}
                      className="hover:text-brand"
                    >
                      {formatPhone(order.shippingAddress.altPhone)}
                    </a>
                  </>
                ) : null}
              </p>
              <p className="text-[0.8125rem] break-all">
                <a href={`mailto:${order.shipEmail}`} className="hover:text-brand">
                  {order.shipEmail}
                </a>
              </p>
            </div>
          </AdminCard>

          {order.shipment ? (
            <AdminCard title="Shipment">
              <dl className="space-y-2.5 text-[0.8125rem]">
                <div>
                  <dt className="aw-eyebrow mb-0.5">Courier</dt>
                  <dd>{order.shipment.courierName}</dd>
                </div>
                <div>
                  <dt className="aw-eyebrow mb-0.5">AWB</dt>
                  <dd className="aw-tabular break-all select-all">
                    {order.shipment.trackingNumber}
                  </dd>
                </div>
                {order.shipment.shippedAt ? (
                  <div>
                    <dt className="aw-eyebrow mb-0.5">Dispatched</dt>
                    <dd className="text-muted">{formatDateTime(order.shipment.shippedAt)}</dd>
                  </div>
                ) : null}
              </dl>
              {order.shipment.trackingUrl ? (
                <a
                  href={order.shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aw-btn aw-btn-outline aw-btn-sm mt-4 w-full"
                >
                  Open tracking
                </a>
              ) : null}
            </AdminCard>
          ) : null}

          {order.payment ? (
            <AdminCard title="Payment">
              <dl className="space-y-2.5 text-[0.8125rem]">
                <div>
                  <dt className="aw-eyebrow mb-0.5">Method</dt>
                  <dd className="uppercase">{order.payment.method ?? '—'}</dd>
                </div>
                <div>
                  <dt className="aw-eyebrow mb-0.5">Razorpay payment</dt>
                  <dd className="aw-tabular text-xs break-all text-muted">
                    {order.payment.razorpayPaymentId ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="aw-eyebrow mb-0.5">Razorpay order</dt>
                  <dd className="aw-tabular text-xs break-all text-muted">
                    {order.payment.razorpayOrderId ?? '—'}
                  </dd>
                </div>
                {order.payment.errorDescription ? (
                  <div>
                    <dt className="aw-eyebrow mb-0.5">Error</dt>
                    <dd className="text-xs text-danger">{order.payment.errorDescription}</dd>
                  </div>
                ) : null}
              </dl>
            </AdminCard>
          ) : null}

          {order.cancelReason ? (
            <AdminCard title="Cancellation">
              <p className="text-[0.8125rem] text-muted">{order.cancelReason}</p>
              {order.cancelledAt ? (
                <p className="mt-1 text-xs text-muted">
                  {formatDateTime(order.cancelledAt)}
                </p>
              ) : null}
            </AdminCard>
          ) : null}
        </div>
      </div>

      {/* --------------------------------------------------- ship dialog */}
      {shipOpen ? (
        <ShipOrderDialog
          orderId={order.id}
          orderNumber={order.orderNumber}
          onClose={() => setShipOpen(false)}
          onShipped={() => {
            setShipOpen(false);
            void load();
          }}
        />
      ) : null}

      {/* ------------------------------------------------- cancel dialog */}
      {cancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-ink)_45%,transparent)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            className="aw-card w-full max-w-md p-6"
          >
            <h2 id="cancel-title" className="text-xl">
              Cancel {order.orderNumber}?
            </h2>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
              {order.paymentStatus === 'paid'
                ? 'This refunds the customer through Razorpay and returns the stock. It cannot be undone.'
                : 'This releases the reserved stock. It cannot be undone.'}
            </p>

            <div className="mt-5">
              <label htmlFor="cancel-reason" className="aw-label">
                Reason <span className="text-accent">*</span>
              </label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="aw-field resize-y"
                placeholder="e.g. Customer requested cancellation by phone"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => void cancelOrder()}
                disabled={busy || !cancelReason.trim()}
                className="aw-btn aw-btn-danger sm:flex-1"
              >
                {busy ? 'Cancelling…' : 'Cancel the order'}
              </button>
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                disabled={busy}
                className="aw-btn aw-btn-outline"
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[0.8125rem] text-muted">{label}</dt>
      <dd className="aw-tabular text-[0.8125rem]">{value}</dd>
    </div>
  );
}
