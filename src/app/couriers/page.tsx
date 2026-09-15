'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminCard, AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton } from '@/components/ui';
import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { mockCouriers } from '@/lib/mock-data';
import type { Courier } from '@/lib/types';

/**
 * Couriers and their tracking URL templates.
 *
 * These live in the database precisely so a dead tracking link is fixed from
 * here with no deploy — courier sites change these URLs without notice, and
 * aggregator sites confidently propagate stale ones.
 *
 * `supportsDeepLink = false` means the courier CAPTCHA-gates its tracking page:
 * the customer email then shows a large copyable number plus a link to the
 * landing page, rather than a deep link that 404s and reads as a scam.
 */
export default function AdminCouriersPage() {
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Courier | null>(null);

  const user = getUser();
  const editable = can(user, 'couriers.edit');

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setCouriers(await adminApi.couriers(token));
      setError(null);
    } catch (err) {
      if (USE_MOCKS || (err instanceof ApiError && err.isNetworkError)) {
        setCouriers(mockCouriers);
      } else {
        setError(err instanceof ApiError ? err.friendlyMessage : 'Could not load couriers.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const token = getToken();
    if (!token || !editing) return;

    setBusy(true);
    setError(null);
    try {
      await adminApi.updateCourier(token, editing.id, {
        name: editing.name,
        trackingUrlTemplate: editing.trackingUrlTemplate,
        supportsDeepLink: editing.supportsDeepLink,
        awbPattern: editing.awbPattern,
        phone: editing.phone,
        isActive: editing.isActive,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : 'Could not save that courier.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminHeading
        title="Couriers"
        description="Tracking link templates. {TRACKING_NUMBER} is replaced when the email is sent."
      />

      <AdminError message={error} />

      <div className="aw-card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <LineSkeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !couriers || couriers.length === 0 ? (
          <AdminEmpty message="No couriers configured." />
        ) : (
          <div className="overflow-x-auto">
            <table className="aw-table">
              <thead>
                <tr className="border-b border-line bg-surface-alt">
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Courier</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Tracking template</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Deep link</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Active</th>
                  {editable ? <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]" /> : null}
                </tr>
              </thead>
              <tbody>
                {couriers.map((courier) => (
                  <tr key={courier.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-[0.875rem]">{courier.name}</p>
                      <p className="aw-tabular text-xs text-muted">{courier.slug}</p>
                    </td>
                    <td data-label="Tracking template" className="px-4 py-3">
                      <p className="aw-tabular max-w-md truncate text-xs text-muted">
                        {courier.trackingUrlTemplate ?? '—'}
                      </p>
                    </td>
                    <td data-label="Deep link" className="px-4 py-3">
                      <span
                        className={`aw-badge ${
                          courier.supportsDeepLink
                            ? 'bg-[color-mix(in_srgb,var(--color-brand-soft)_14%,transparent)] text-brand-soft'
                            : 'bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[#8a6c26]'
                        }`}
                      >
                        {courier.supportsDeepLink ? 'Works' : 'Number only'}
                      </span>
                    </td>
                    <td data-label="Active" className="px-4 py-3">
                      <span className="aw-badge bg-surface-alt text-muted">
                        {courier.isActive ? 'Yes' : 'No'}
                      </span>
                    </td>
                    {editable ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(courier)}
                          className="aw-btn aw-btn-outline aw-btn-sm"
                        >
                          Edit
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--color-ink)_45%,transparent)] p-4 sm:p-8">
          <AdminCard title={`Edit ${editing.name}`} className="w-full max-w-lg">
            <div className="space-y-4">
              <div>
                <label htmlFor="cu-name" className="aw-label">
                  Name
                </label>
                <input
                  id="cu-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="aw-field"
                />
              </div>

              <div>
                <label htmlFor="cu-template" className="aw-label">
                  Tracking URL template
                </label>
                <input
                  id="cu-template"
                  value={editing.trackingUrlTemplate ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, trackingUrlTemplate: e.target.value || null })
                  }
                  className="aw-field aw-tabular text-xs"
                />
                <p className="aw-hint">
                  Use {'{TRACKING_NUMBER}'} where the AWB goes.
                </p>
              </div>

              <div>
                <label htmlFor="cu-pattern" className="aw-label">
                  AWB format (regex)
                </label>
                <input
                  id="cu-pattern"
                  value={editing.awbPattern ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, awbPattern: e.target.value || null })
                  }
                  className="aw-field aw-tabular text-xs"
                />
                <p className="aw-hint">
                  Only warns on mismatch — it never blocks a shipment.
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
                <input
                  type="checkbox"
                  checked={editing.supportsDeepLink}
                  onChange={(e) =>
                    setEditing({ ...editing, supportsDeepLink: e.target.checked })
                  }
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                Tracking link works when clicked
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                Offer this courier when shipping
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="aw-btn aw-btn-primary sm:flex-1"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
                className="aw-btn aw-btn-outline"
              >
                Cancel
              </button>
            </div>
          </AdminCard>
        </div>
      ) : null}
    </div>
  );
}
