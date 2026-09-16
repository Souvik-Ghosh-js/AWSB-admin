'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import { dateOnly, money, toPaise, toRupeeInput } from '@/lib/format';
import {
  CardSkeleton, ConfirmSheet, EmptyState, ErrorBox, PageHeader, Sheet, Spinner, Toast,
} from '@/components/ui';
import type { Coupon, Page } from '@/lib/types';

export default function CouponsPage() {
  const { data, error, loading, reload } = useApi<Page<Coupon>>((t) => api.coupons(t, { limit: 50 }));
  const { run, busy } = useAction();

  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'danger' } | null>(null);

  async function doDelete() {
    if (!deleting) return;
    const ok = await run((t) => api.deleteCoupon(t, deleting.id));
    setDeleting(null);
    if (ok !== null) {
      setToast({ msg: `${deleting.code} removed.`, tone: 'ok' });
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Discount codes customers type at checkout."
        action={
          <button type="button" onClick={() => setEditing('new')} className="ad-btn ad-btn-primary">
            New coupon
          </button>
        }
      />

      {loading ? (
        <CardSkeleton rows={3} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No coupons yet"
          message="Create a code like WELCOME10 to give a percentage or flat discount."
          action={
            <button type="button" onClick={() => setEditing('new')} className="ad-btn ad-btn-primary">
              Create one
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((c) => {
            const expired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
            const exhausted = c.usageLimit != null && c.usedCount >= c.usageLimit;

            return (
              <div key={c.id} className="ad-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="ad-mono text-base font-semibold">{c.code}</p>
                    <p className="mt-1 text-sm text-[color:var(--color-soft)]">
                      {c.discountType === 'percent'
                        ? `${c.discountValue}% off`
                        : `${money(c.discountValue, { compact: true })} off`}
                      {c.maxDiscountPaise
                        ? ` (max ${money(c.maxDiscountPaise, { compact: true })})`
                        : ''}
                      {c.minOrderPaise > 0
                        ? ` · min order ${money(c.minOrderPaise, { compact: true })}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`ad-pill shrink-0 ${
                      !c.isActive || expired || exhausted ? 'ad-pill-muted' : 'ad-pill-ok'
                    }`}
                  >
                    {!c.isActive ? 'Off' : expired ? 'Expired' : exhausted ? 'Used up' : 'Live'}
                  </span>
                </div>

                <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                  Used {c.usedCount}
                  {c.usageLimit != null ? ` of ${c.usageLimit}` : ' times'}
                  {c.expiresAt ? ` · expires ${dateOnly(c.expiresAt)}` : ''}
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="ad-btn ad-btn-outline ad-btn-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(c)}
                    className="ad-btn ad-btn-ghost ad-btn-sm text-[color:var(--color-danger)]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <CouponSheet
          coupon={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setToast({ msg, tone: 'ok' });
            reload();
          }}
        />
      ) : null}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        busy={busy}
        danger
        title={`Delete ${deleting?.code ?? ''}?`}
        message="Customers can no longer use this code. Orders that already used it keep their discount."
        confirmLabel="Delete"
      />

      {toast ? <Toast message={toast.msg} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}

function CouponSheet({
  coupon,
  onClose,
  onSaved,
}: {
  coupon: Coupon | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { run, busy, error } = useAction();
  const isNew = !coupon;

  const [code, setCode] = useState(coupon?.code ?? '');
  const [type, setType] = useState<'percent' | 'fixed'>(coupon?.discountType ?? 'percent');
  const [value, setValue] = useState(
    coupon
      ? coupon.discountType === 'percent'
        ? String(coupon.discountValue)
        : toRupeeInput(coupon.discountValue)
      : '',
  );
  const [maxDiscount, setMaxDiscount] = useState(toRupeeInput(coupon?.maxDiscountPaise ?? null));
  const [minOrder, setMinOrder] = useState(toRupeeInput(coupon?.minOrderPaise ?? null));
  const [limit, setLimit] = useState(coupon?.usageLimit != null ? String(coupon.usageLimit) : '');
  const [expires, setExpires] = useState(coupon?.expiresAt?.slice(0, 10) ?? '');
  const [active, setActive] = useState(coupon?.isActive ?? true);

  const numValue = Number(value) || 0;
  const valid =
    code.trim().length >= 3 &&
    numValue > 0 &&
    (type !== 'percent' || numValue <= 100);

  async function save() {
    const payload = {
      code: code.trim().toUpperCase(),
      discount_type: type,
      discount_value: type === 'percent' ? numValue : toPaise(value),
      max_discount_paise: type === 'percent' && maxDiscount ? toPaise(maxDiscount) : null,
      min_order_paise: minOrder ? toPaise(minOrder) : 0,
      usage_limit: limit ? Number(limit) : null,
      expires_at: expires || null,
      is_active: active,
    };

    const ok = await run((t) =>
      isNew ? api.createCoupon(t, payload) : api.updateCoupon(t, coupon.id, payload),
    );
    if (ok !== null) {
      onSaved(isNew ? `${payload.code} created.` : `${payload.code} saved.`);
      onClose();
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'New coupon' : `Edit ${coupon.code}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy || !valid} className="ad-btn ad-btn-primary flex-1">
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      }
    >
      <div>
        <label htmlFor="code" className="ad-label">Code</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="WELCOME10"
          autoCapitalize="characters"
          className="ad-input ad-mono"
        />
        <p className="ad-hint">Customers type this at checkout. Not case sensitive.</p>
      </div>

      <div className="mt-4">
        <span className="ad-label">Discount</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('percent')}
            aria-pressed={type === 'percent'}
            className={`ad-btn ad-btn-sm flex-1 ${type === 'percent' ? 'ad-btn-primary' : 'ad-btn-outline'}`}
          >
            Percentage
          </button>
          <button
            type="button"
            onClick={() => setType('fixed')}
            aria-pressed={type === 'fixed'}
            className={`ad-btn ad-btn-sm flex-1 ${type === 'fixed' ? 'ad-btn-primary' : 'ad-btn-outline'}`}
          >
            Fixed ₹
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="value" className="ad-label">
          {type === 'percent' ? 'Percent off' : 'Amount off (₹)'}
        </label>
        <input
          id="value"
          type="number"
          inputMode="decimal"
          min="0"
          max={type === 'percent' ? 100 : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="ad-input ad-num"
        />
        {type === 'percent' && numValue > 100 ? (
          <p className="ad-error">A percentage cannot be over 100.</p>
        ) : null}
      </div>

      {type === 'percent' ? (
        <div className="mt-4">
          <label htmlFor="max" className="ad-label">Cap the discount at (₹, optional)</label>
          <input
            id="max"
            type="number"
            inputMode="decimal"
            min="0"
            value={maxDiscount}
            onChange={(e) => setMaxDiscount(e.target.value)}
            className="ad-input ad-num"
          />
          <p className="ad-hint">Stops a big order giving away too much.</p>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="min" className="ad-label">Min order (₹)</label>
          <input
            id="min"
            type="number"
            inputMode="decimal"
            min="0"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            className="ad-input ad-num"
          />
        </div>
        <div>
          <label htmlFor="limit" className="ad-label">Total uses</label>
          <input
            id="limit"
            type="number"
            inputMode="numeric"
            min="1"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Unlimited"
            className="ad-input ad-num"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="expires" className="ad-label">Expires (optional)</label>
        <input
          id="expires"
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          className="ad-input"
        />
      </div>

      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5 accent-[color:var(--color-brand)]"
        />
        Active
      </label>

      {error ? <p className="ad-error mt-3">{error}</p> : null}
    </Sheet>
  );
}
