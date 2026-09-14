'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminCard, AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton } from '@/components/ui';
import { ApiError, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { formatDate, formatPaise, rupeesToPaise } from '@/lib/format';
import type { Coupon, DiscountType } from '@/lib/types';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const user = getUser();
  const editable = can(user, 'coupons.edit');

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const result = await adminApi.coupons(token);
      setCoupons(result.items ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        setCoupons([]);
      } else {
        setError(err instanceof ApiError ? err.friendlyMessage : 'Could not load coupons.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const token = getToken();
    if (!token) return;

    if (!code.trim() || !discountValue.trim()) {
      setError('A coupon needs a code and a discount value.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await adminApi.createCoupon(token, {
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discountType,
        // Percent is a whole number (10 = 10%); fixed is paise.
        discountValue:
          discountType === 'percent'
            ? Math.floor(Number(discountValue))
            : rupeesToPaise(discountValue),
        maxDiscountPaise: maxDiscount.trim() ? rupeesToPaise(maxDiscount) : null,
        minOrderPaise: minOrder.trim() ? rupeesToPaise(minOrder) : 0,
        usageLimit: usageLimit.trim() ? Math.floor(Number(usageLimit)) : null,
        expiresAt: expiresAt || null,
        isActive: true,
      });
      setCreating(false);
      setCode('');
      setDescription('');
      setDiscountValue('');
      setMaxDiscount('');
      setMinOrder('');
      setUsageLimit('');
      setExpiresAt('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : 'Could not create that coupon.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (coupon: Coupon) => {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try {
      await adminApi.updateCoupon(token, coupon.id, { isActive: !coupon.isActive });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : 'Could not update that coupon.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminHeading
        title="Coupons"
        description="Discount codes, their limits and how often they have been used."
        action={
          editable ? (
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="aw-btn aw-btn-primary aw-btn-sm"
            >
              {creating ? 'Close' : 'New coupon'}
            </button>
          ) : null
        }
      />

      <AdminError message={error} />

      {creating ? (
        <AdminCard title="New coupon" className="mb-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="c-code" className="aw-label">
                Code <span className="text-accent">*</span>
              </label>
              <input
                id="c-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="aw-field aw-tabular uppercase"
                placeholder="PUJA10"
              />
            </div>

            <div>
              <label htmlFor="c-type" className="aw-label">
                Type
              </label>
              <select
                id="c-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="aw-field"
              >
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </div>

            <div>
              <label htmlFor="c-value" className="aw-label">
                {discountType === 'percent' ? 'Percent off' : 'Amount off (₹)'}{' '}
                <span className="text-accent">*</span>
              </label>
              <input
                id="c-value"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                className="aw-field aw-tabular"
                placeholder={discountType === 'percent' ? '10' : '100'}
              />
            </div>

            {discountType === 'percent' ? (
              <div>
                <label htmlFor="c-max" className="aw-label">
                  Cap the discount at (₹)
                </label>
                <input
                  id="c-max"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  className="aw-field aw-tabular"
                  placeholder="Optional"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="c-min" className="aw-label">
                Minimum order (₹)
              </label>
              <input
                id="c-min"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                className="aw-field aw-tabular"
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="c-limit" className="aw-label">
                Total uses allowed
              </label>
              <input
                id="c-limit"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                className="aw-field aw-tabular"
                placeholder="Unlimited"
              />
            </div>

            <div>
              <label htmlFor="c-expires" className="aw-label">
                Expires
              </label>
              <input
                id="c-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="aw-field"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="c-desc" className="aw-label">
                Description
              </label>
              <input
                id="c-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="aw-field"
                placeholder="Internal note — what this code is for"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="aw-btn aw-btn-primary aw-btn-sm mt-5"
          >
            {busy ? 'Creating…' : 'Create coupon'}
          </button>
        </AdminCard>
      ) : null}

      <div className="aw-card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }, (_, i) => (
              <LineSkeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !coupons || coupons.length === 0 ? (
          <AdminEmpty message="No coupons yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-alt">
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Code</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Discount</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Minimum</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Used</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Expires</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Status</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <span className="aw-tabular text-[0.875rem] font-medium">
                        {coupon.code}
                      </span>
                      {coupon.description ? (
                        <p className="text-xs text-muted">{coupon.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[0.8125rem]">
                      {coupon.discountType === 'percent'
                        ? `${coupon.discountValue}%`
                        : formatPaise(coupon.discountValue, { compact: true })}
                      {coupon.maxDiscountPaise ? (
                        <span className="text-xs text-muted">
                          {' '}
                          max {formatPaise(coupon.maxDiscountPaise, { compact: true })}
                        </span>
                      ) : null}
                    </td>
                    <td className="aw-tabular px-4 py-3 text-[0.8125rem] text-muted">
                      {coupon.minOrderPaise
                        ? formatPaise(coupon.minOrderPaise, { compact: true })
                        : '—'}
                    </td>
                    <td className="aw-tabular px-4 py-3 text-[0.8125rem]">
                      {coupon.usedCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {coupon.expiresAt ? formatDate(coupon.expiresAt) : 'No expiry'}
                    </td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => void toggle(coupon)}
                          disabled={busy}
                          className={`aw-badge cursor-pointer ${
                            coupon.isActive
                              ? 'bg-[color-mix(in_srgb,var(--color-brand-soft)_14%,transparent)] text-brand-soft'
                              : 'bg-surface-alt text-muted'
                          }`}
                        >
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span className="aw-badge bg-surface-alt text-muted">
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
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
