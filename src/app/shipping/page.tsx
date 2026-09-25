'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import { money, toPaise, toRupeeInput } from '@/lib/format';
import {
  CardSkeleton, ConfirmSheet, EmptyState, ErrorBox, PageHeader, Sheet, Spinner, Toast,
} from '@/components/ui';
import type { ShippingZone } from '@/lib/types';

/**
 * Shipping zones — what checkout actually charges. A zone is a flat rate
 * (Kolkata ₹49, rest of India ₹99 today) plus an optional "free above ₹X"
 * threshold, matched by which of its pincode ranges the delivery address
 * falls into. Exactly one zone must be the fallback — the one used when a
 * pincode matches no range at all — so removing it or leaving it unset
 * would make checkout fail for any address outside every configured range.
 */
export default function ShippingPage() {
  const { data, error, loading, reload } = useApi<ShippingZone[]>((t) => api.shippingZones(t));
  const [editing, setEditing] = useState<ShippingZone | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Shipping"
        subtitle="What checkout charges, by delivery pincode. Exactly one zone is the fallback for any address outside every other zone's ranges."
        action={
          <button type="button" onClick={() => setEditing('new')} className="ad-btn ad-btn-primary">
            Add zone
          </button>
        }
      />

      {loading ? (
        <CardSkeleton rows={3} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No shipping zones yet" message="Add one, e.g. Kolkata." />
      ) : (
        <div className="space-y-3">
          {data.map((z) => (
            <div key={z.id} className="ad-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{z.name}</p>
                    {z.isFallback ? <span className="ad-pill ad-pill-ok">Fallback</span> : null}
                    {!z.isActive ? <span className="ad-pill ad-pill-muted">Off</span> : null}
                  </div>
                  <p className="ad-money mt-1 text-sm">{money(z.ratePaise, { compact: true })}</p>
                  {z.freeAbovePaise != null ? (
                    <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                      Free above {money(z.freeAbovePaise, { compact: true })}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-[color:var(--color-muted)]">
                    {z.pincodeRanges.length === 0
                      ? 'No pincode ranges — this zone never matches directly.'
                      : z.pincodeRanges
                          .map((r) => `${r.pincodeStart}–${r.pincodeEnd}`)
                          .join(', ')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditing(z)}
                className="ad-btn ad-btn-outline ad-btn-sm mt-3"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <ZoneSheet
          zone={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setToast(msg);
            reload();
          }}
        />
      ) : null}

      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}

type RangeDraft = { pincodeStart: string; pincodeEnd: string };

function ZoneSheet({
  zone,
  onClose,
  onSaved,
}: {
  zone: ShippingZone | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { run, busy, error } = useAction();
  const { run: runDelete, busy: deleting, error: deleteError } = useAction();
  const isNew = !zone;

  const [name, setName] = useState(zone?.name ?? '');
  const [rate, setRate] = useState(zone ? toRupeeInput(zone.ratePaise) : '');
  const [freeAbove, setFreeAbove] = useState(zone?.freeAbovePaise != null ? toRupeeInput(zone.freeAbovePaise) : '');
  const [isFallback, setIsFallback] = useState(zone?.isFallback ?? false);
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);
  const [ranges, setRanges] = useState<RangeDraft[]>(
    zone?.pincodeRanges.map((r) => ({ pincodeStart: r.pincodeStart, pincodeEnd: r.pincodeEnd })) ?? [],
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const validRanges = ranges.every((r) => /^\d{6}$/.test(r.pincodeStart) && /^\d{6}$/.test(r.pincodeEnd) && r.pincodeStart <= r.pincodeEnd);
  const canSave = name.trim().length >= 2 && toPaise(rate) >= 0 && validRanges;

  function addRange() {
    setRanges((prev) => [...prev, { pincodeStart: '', pincodeEnd: '' }]);
  }
  function setRange(i: number, patch: Partial<RangeDraft>) {
    setRanges((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRange(i: number) {
    setRanges((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    const payload = {
      name: name.trim(),
      rate_paise: toPaise(rate),
      free_above_paise: freeAbove.trim() ? toPaise(freeAbove) : null,
      is_fallback: isFallback,
      is_active: isActive,
      pincode_ranges: ranges.map((r) => ({ pincode_start: r.pincodeStart, pincode_end: r.pincodeEnd })),
    };
    const ok = await run((t) =>
      isNew ? api.createShippingZone(t, payload) : api.updateShippingZone(t, zone.id, payload),
    );
    if (ok !== null) {
      onSaved(isNew ? `${payload.name} added.` : `${payload.name} saved.`);
      onClose();
    }
  }

  async function remove() {
    if (!zone) return;
    const ok = await runDelete((t) => api.deleteShippingZone(t, zone.id));
    setConfirmDeleteOpen(false);
    if (ok !== null) {
      onSaved(`${zone.name} deleted.`);
      onClose();
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'Add shipping zone' : `Edit ${zone.name}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !canSave}
            className="ad-btn ad-btn-primary flex-1"
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Save
          </button>
        </div>
      }
    >
      <div>
        <label htmlFor="zname" className="ad-label">Name</label>
        <input id="zname" value={name} onChange={(e) => setName(e.target.value)} className="ad-input" />
      </div>

      <div className="mt-4">
        <label htmlFor="zrate" className="ad-label">Shipping charge (₹)</label>
        <input
          id="zrate"
          type="number"
          inputMode="decimal"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="ad-input ad-num"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="zfree" className="ad-label">Free shipping above (₹, optional)</label>
        <input
          id="zfree"
          type="number"
          inputMode="decimal"
          min="0"
          value={freeAbove}
          onChange={(e) => setFreeAbove(e.target.value)}
          placeholder="Leave blank for no free-shipping threshold"
          className="ad-input ad-num"
        />
      </div>

      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-5 w-5 accent-[color:var(--color-brand)]"
        />
        Active
      </label>

      <label className="mt-3 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={isFallback}
          onChange={(e) => setIsFallback(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--color-brand)]"
        />
        <span>
          Fallback zone
          <span className="mt-0.5 block text-xs text-[color:var(--color-muted)]">
            Used for any pincode that matches no range below, on this or any other zone. Turning this
            on here turns it off wherever else it was set.
          </span>
        </span>
      </label>

      <div className="mt-5 border-t border-[color:var(--color-line)] pt-4">
        <div className="flex items-center justify-between">
          <span className="ad-label">Pincode ranges</span>
          <button type="button" onClick={addRange} className="ad-btn ad-btn-outline ad-btn-sm">
            Add range
          </button>
        </div>

        {ranges.length === 0 ? (
          <p className="ad-hint mt-2">
            No ranges — this zone only ever applies as the fallback, if it is one.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {ranges.map((r, i) => {
              const rowInvalid =
                (r.pincodeStart && !/^\d{6}$/.test(r.pincodeStart)) ||
                (r.pincodeEnd && !/^\d{6}$/.test(r.pincodeEnd)) ||
                (/^\d{6}$/.test(r.pincodeStart) && /^\d{6}$/.test(r.pincodeEnd) && r.pincodeStart > r.pincodeEnd);
              return (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <input
                      value={r.pincodeStart}
                      onChange={(e) => setRange(i, { pincodeStart: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="700001"
                      inputMode="numeric"
                      aria-label={`Range ${i + 1} start pincode`}
                      className="ad-input ad-mono ad-num"
                    />
                    <span className="text-[color:var(--color-muted)]">–</span>
                    <input
                      value={r.pincodeEnd}
                      onChange={(e) => setRange(i, { pincodeEnd: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="700199"
                      inputMode="numeric"
                      aria-label={`Range ${i + 1} end pincode`}
                      className="ad-input ad-mono ad-num"
                    />
                    <button
                      type="button"
                      onClick={() => removeRange(i)}
                      aria-label={`Remove range ${i + 1}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[color:var(--color-muted)] hover:bg-[color:var(--color-surface-alt)]"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {rowInvalid ? (
                    <p className="ad-error mt-1">Two 6-digit pincodes, start not after end.</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error ? <p className="ad-error mt-3">{error}</p> : null}

      {!isNew ? (
        <div className="mt-6 border-t border-[color:var(--color-line)] pt-4">
          {zone.isFallback ? (
            <p className="text-xs text-[color:var(--color-muted)]">
              Can&rsquo;t delete — this is the fallback zone. Make another zone the fallback first.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="ad-btn ad-btn-outline ad-btn-sm text-[color:var(--color-danger)]"
            >
              Delete zone
            </button>
          )}
          {deleteError ? <p className="ad-error mt-2">{deleteError}</p> : null}
        </div>
      ) : null}

      {zone ? (
        <ConfirmSheet
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={remove}
          title="Delete shipping zone"
          message={`Delete "${zone.name}"? Checkout will stop offering this rate immediately.`}
          confirmLabel="Delete"
          danger
          busy={deleting}
        />
      ) : null}
    </Sheet>
  );
}
