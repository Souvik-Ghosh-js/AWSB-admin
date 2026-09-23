'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/lib/api';
import { useApi, useAction } from '@/lib/useApi';
import { getUser, can } from '@/lib/auth';
import { dateTime, money, humanise } from '@/lib/format';
import { ShipSheet } from '@/components/ShipSheet';
import {
  CardSkeleton, ConfirmSheet, ErrorBox, Field, PageHeader, PaymentPill, Sheet,
  Spinner, StatusPill, Toast,
} from '@/components/ui';
import type { OrderDetail } from '@/lib/types';

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const { data, error, loading, reload } = useApi<OrderDetail>((t) => api.order(t, id), [id]);
  const { run, busy } = useAction();

  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'danger' } | null>(null);

  const user = typeof window !== 'undefined' ? getUser() : null;

  if (loading) return <CardSkeleton rows={6} />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const o = data;
  const shipment = o.shipments[0] ?? null;

  // Mirrors the server's state machine. A shipped order cannot be cancelled —
  // the parcel is already with the courier, so cancelling would tell the
  // customer something untrue. That case is a refund after the fact.
  const canShip = o.status === 'confirmed' || o.status === 'packed';
  const canDeliver = o.status === 'shipped';
  const canCancel = ['pending_payment', 'confirmed', 'packed'].includes(o.status);
  // Mirrors the server's guard exactly: only orders that never took a
  // captured payment, or that were already cancelled (and refunded if there
  // was anything to refund), can be permanently deleted.
  const canDelete = ['pending_payment', 'cancelled'].includes(o.status);

  async function doDeliver() {
    const ok = await run((t) => api.deliverOrder(t, id));
    setDeliverOpen(false);
    if (ok !== null) {
      setToast({ msg: 'Marked delivered. The customer has been emailed.', tone: 'ok' });
      reload();
    }
  }

  async function doCancel() {
    if (reason.trim().length < 3) return;
    const ok = await run((t) => api.cancelOrder(t, id, reason.trim()));
    setCancelOpen(false);
    if (ok !== null) {
      setToast({ msg: 'Order cancelled. Stock returned and the customer emailed.', tone: 'ok' });
      setReason('');
      reload();
    }
  }

  // Permanent — the order, its items, payments and refund records are gone
  // for good afterwards. The server independently re-checks status !==
  // pending_payment/cancelled, so this button being visible is not itself
  // the security boundary.
  async function doDelete() {
    if (deleteConfirmText.trim() !== o.orderNumber) return;
    const ok = await run((t) => api.deleteOrder(t, id));
    setDeleteOpen(false);
    if (ok !== null) {
      router.replace('/orders');
    }
  }

  return (
    <>
      <div className="mb-4">
        <Link href="/orders" className="ad-link text-sm">
          ← All orders
        </Link>
      </div>

      <PageHeader
        title={o.orderNumber}
        subtitle={`Placed ${dateTime(o.placedAt ?? o.createdAt)}`}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <StatusPill status={o.status} />
        <PaymentPill status={o.paymentStatus} />
        <span className="ad-pill ad-pill-muted">
          {o.shipZone === 'kolkata' ? 'Kolkata' : 'Rest of India'}
        </span>
      </div>

      {/* ------------------------------------------------------- actions */}
      {(canShip || canDeliver || canCancel) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {canShip ? (
            <button type="button" onClick={() => setShipOpen(true)} className="ad-btn ad-btn-primary flex-1 sm:flex-none">
              Ship this order
            </button>
          ) : null}
          {canDeliver ? (
            <button type="button" onClick={() => setDeliverOpen(true)} className="ad-btn ad-btn-primary flex-1 sm:flex-none">
              Mark delivered
            </button>
          ) : null}
          {canCancel && can(user, 'manager') ? (
            <button type="button" onClick={() => setCancelOpen(true)} className="ad-btn ad-btn-outline flex-1 sm:flex-none">
              Cancel order
            </button>
          ) : null}
        </div>
      )}

      {canDelete && can(user, 'owner') ? (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="ad-btn ad-btn-outline ad-btn-sm text-[color:var(--color-danger)]"
          >
            Delete permanently
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------------- items */}
        <section className="ad-card overflow-hidden lg:col-span-2">
          <h2 className="border-b border-[color:var(--color-line)] px-4 py-3 text-base">Items</h2>
          <ul className="ad-divide">
            {o.items.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{it.productName}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                    {it.sizeMl}ml · {it.sku} · {money(it.unitPricePaise, { compact: true })} each
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="ad-num text-sm">× {it.quantity}</p>
                  <p className="ad-money text-sm">{money(it.lineTotalPaise, { compact: true })}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-[color:var(--color-line)] bg-[color:var(--color-surface-alt)] px-4 py-3">
            <Field label="Subtotal">{money(o.subtotalPaise)}</Field>
            {o.discountPaise > 0 ? (
              <Field label={`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`}>
                −{money(o.discountPaise)}
              </Field>
            ) : null}
            <Field label="Shipping">{money(o.shippingPaise)}</Field>
            <div className="mt-1 flex items-baseline justify-between border-t border-[color:var(--color-line)] pt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="ad-money text-lg">{money(o.totalPaise)}</span>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          {/* --------------------------------------------------- delivery */}
          <section className="ad-card p-4">
            <h2 className="mb-3 text-base">Deliver to</h2>
            <p className="text-sm font-medium">{o.shipFullName}</p>
            <address className="mt-1 text-sm not-italic leading-relaxed text-[color:var(--color-soft)]">
              {o.shipLine1}
              {o.shipLine2 ? <><br />{o.shipLine2}</> : null}
              {o.shipLandmark ? <><br />Near {o.shipLandmark}</> : null}
              <br />
              {o.shipCity}, {o.shipState} {o.shipPincode}
            </address>

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:+91${o.shipPhone}`} className="ad-btn ad-btn-outline ad-btn-sm">
                Call {o.shipPhone}
              </a>
              {o.shipAltPhone ? (
                <a href={`tel:+91${o.shipAltPhone}`} className="ad-btn ad-btn-outline ad-btn-sm">
                  Alt {o.shipAltPhone}
                </a>
              ) : null}
            </div>
            <p className="mt-3 break-all text-xs text-[color:var(--color-muted)]">{o.shipEmail}</p>

            {o.customerNote ? (
              <div className="mt-4 rounded-md bg-[color:var(--color-warn-bg)] p-3">
                <p className="ad-eyebrow text-[color:var(--color-warn)]">Customer note</p>
                <p className="mt-1 text-sm">{o.customerNote}</p>
              </div>
            ) : null}
          </section>

          {/* --------------------------------------------------- shipment */}
          {shipment ? (
            <section className="ad-card p-4">
              <h2 className="mb-3 text-base">Shipment</h2>
              <Field label="Courier">{shipment.courierName}</Field>
              <Field label="Tracking">
                <span className="ad-mono select-all">{shipment.trackingNumber}</span>
              </Field>
              <Field label="Shipped">{dateTime(shipment.shippedAt)}</Field>
              {shipment.trackingUrl ? (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ad-btn ad-btn-outline ad-btn-sm mt-3 w-full"
                >
                  {shipment.supportsDeepLink ? 'Track parcel' : 'Open courier site'}
                </a>
              ) : null}
            </section>
          ) : null}

          {o.cancelReason ? (
            <section className="ad-card border-[color:var(--color-danger)]/25 bg-[color:var(--color-danger-bg)] p-4">
              <p className="ad-eyebrow text-[color:var(--color-danger)]">Cancelled</p>
              <p className="mt-1 text-sm">{o.cancelReason}</p>
            </section>
          ) : null}
        </div>
      </div>

      {/* --------------------------------------------------------- sheets */}
      <ShipSheet
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        orderId={id}
        orderNumber={o.orderNumber}
        onShipped={() => {
          setToast({ msg: 'Shipped. Tracking details emailed to the customer.', tone: 'ok' });
          reload();
        }}
      />

      <ConfirmSheet
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        onConfirm={doDeliver}
        busy={busy}
        title="Mark as delivered?"
        message="This emails the customer a thank-you and invites them to review what they bought. It cannot be undone."
        confirmLabel="Mark delivered"
      />

      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this order?"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setCancelOpen(false)} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
              Keep it
            </button>
            <button
              type="button"
              onClick={doCancel}
              disabled={busy || reason.trim().length < 3}
              className="ad-btn ad-btn-danger flex-1"
            >
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Cancel order
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-[color:var(--color-soft)]">
          Stock goes back on the shelf and the customer is emailed.
          {o.paymentStatus === 'paid'
            ? ' Because this order is paid, a Razorpay refund is issued automatically — it reaches them in 5–7 working days.'
            : ''}
        </p>
        <div className="mt-4">
          <label htmlFor="reason" className="ad-label">
            Reason (the customer sees this)
          </label>
          <input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. out of stock, customer requested"
            className="ad-input"
          />
        </div>
      </Sheet>

      <Sheet
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteConfirmText('');
        }}
        title="Delete this order permanently?"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirmText('');
              }}
              className="ad-btn ad-btn-outline flex-1"
              disabled={busy}
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={doDelete}
              disabled={busy || deleteConfirmText.trim() !== o.orderNumber}
              className="ad-btn ad-btn-danger flex-1"
            >
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Delete permanently
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-[color:var(--color-soft)]">
          This cannot be undone. The order, its items, and any payment or refund records are
          erased completely — not archived, not recoverable.
        </p>
        <div className="mt-4">
          <label htmlFor="delete-confirm" className="ad-label">
            Type <span className="ad-mono">{o.orderNumber}</span> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={o.orderNumber}
            className="ad-input ad-mono"
            autoComplete="off"
          />
        </div>
      </Sheet>

      {toast ? <Toast message={toast.msg} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}
