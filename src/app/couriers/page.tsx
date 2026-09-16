'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import { CardSkeleton, EmptyState, ErrorBox, PageHeader, Sheet, Spinner, Toast } from '@/components/ui';
import type { Courier } from '@/lib/types';

/**
 * Delivery partners.
 *
 * `supportsDeepLink` is the field that matters. Several Indian couriers cannot
 * be deep-linked at all — India Post and Professional Couriers put a CAPTCHA on
 * every lookup, Trackon's published URL 404s, and Shiprocket's is invented.
 * For those, the customer email shows a large copyable number plus a link to
 * the courier's own page. A fabricated deep link drops the customer on an empty
 * form, which reads as a scam in a transactional email.
 */
export default function CouriersPage() {
  const { data, error, loading, reload } = useApi<Courier[]>((t) => api.couriers(t));
  const [editing, setEditing] = useState<Courier | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Couriers"
        subtitle="Who you ship with, and the tracking link each one gives the customer."
        action={
          <button type="button" onClick={() => setEditing('new')} className="ad-btn ad-btn-primary">
            Add courier
          </button>
        }
      />

      {loading ? (
        <CardSkeleton rows={4} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No couriers set up" message="Add the delivery partners you use." />
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <div key={c.id} className="ad-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                    {c.supportsDeepLink
                      ? 'Customer gets a direct tracking link'
                      : 'Customer gets the number to copy — this courier has no working link'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`ad-pill ${c.isActive ? 'ad-pill-ok' : 'ad-pill-muted'}`}>
                    {c.isActive ? 'In use' : 'Off'}
                  </span>
                  {!c.supportsDeepLink ? (
                    <span className="ad-pill ad-pill-warn">No link</span>
                  ) : null}
                </div>
              </div>

              {c.trackingUrlTemplate ? (
                <p className="ad-mono mt-2 break-all text-xs text-[color:var(--color-muted)]">
                  {c.trackingUrlTemplate}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => setEditing(c)}
                className="ad-btn ad-btn-outline ad-btn-sm mt-3"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <CourierSheet
          courier={editing === 'new' ? null : editing}
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

function CourierSheet({
  courier,
  onClose,
  onSaved,
}: {
  courier: Courier | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { run, busy, error } = useAction();
  const isNew = !courier;

  const [name, setName] = useState(courier?.name ?? '');
  const [template, setTemplate] = useState(courier?.trackingUrlTemplate ?? '');
  const [deepLink, setDeepLink] = useState(courier?.supportsDeepLink ?? true);
  const [phone, setPhone] = useState(courier?.phone ?? '');
  const [active, setActive] = useState(courier?.isActive ?? true);

  const missingPlaceholder = deepLink && !!template && !template.includes('{TRACKING_NUMBER}');

  async function save() {
    const payload = {
      name: name.trim(),
      slug: courier?.slug ?? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      tracking_url_template: template.trim() || null,
      supports_deep_link: deepLink,
      phone: phone.trim() || null,
      is_active: active,
    };
    const ok = await run((t) =>
      isNew ? api.createCourier(t, payload) : api.updateCourier(t, courier.id, payload),
    );
    if (ok !== null) {
      onSaved(isNew ? `${payload.name} added.` : `${payload.name} saved.`);
      onClose();
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'Add courier' : `Edit ${courier.name}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || name.trim().length < 2}
            className="ad-btn ad-btn-primary flex-1"
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Save
          </button>
        </div>
      }
    >
      <div>
        <label htmlFor="cname" className="ad-label">Name</label>
        <input id="cname" value={name} onChange={(e) => setName(e.target.value)} className="ad-input" />
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={deepLink}
          onChange={(e) => setDeepLink(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--color-brand)]"
        />
        <span>
          This courier has a working tracking link
          <span className="mt-0.5 block text-xs text-[color:var(--color-muted)]">
            Untick for India Post, DTDC, Professional Couriers and Trackon — their pages need the
            number typed in by hand.
          </span>
        </span>
      </label>

      <div className="mt-4">
        <label htmlFor="tmpl" className="ad-label">
          {deepLink ? 'Tracking link' : 'Tracking page'}
        </label>
        <input
          id="tmpl"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder={
            deepLink
              ? 'https://courier.com/track?awb={TRACKING_NUMBER}'
              : 'https://courier.com/track'
          }
          className="ad-input ad-mono text-sm"
        />
        <p className="ad-hint">
          {deepLink
            ? 'Put {TRACKING_NUMBER} where the number goes.'
            : 'The customer opens this page and pastes the number themselves.'}
        </p>
        {missingPlaceholder ? (
          <p className="ad-hint font-medium text-[color:var(--color-warn)]">
            This link has no {'{TRACKING_NUMBER}'} in it, so every customer lands on the same page.
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor="cphone" className="ad-label">Phone (optional)</label>
        <input
          id="cphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
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
        Show when shipping an order
      </label>

      {error ? <p className="ad-error mt-3">{error}</p> : null}
    </Sheet>
  );
}
