'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import { CardSkeleton, ErrorBox, PageHeader, Spinner, Toast } from '@/components/ui';
import type { SettingsMap } from '@/lib/types';

/**
 * Store settings.
 *
 * Only the keys a shop owner would sensibly change are surfaced with a proper
 * label. Anything else the API returns is still editable at the bottom, as raw
 * key/value, rather than being silently hidden.
 */
const KNOWN: { key: string; label: string; hint?: string; type: 'text' | 'number' | 'bool' }[] = [
  { key: 'store.name', label: 'Shop name', type: 'text' },
  { key: 'store.email', label: 'Contact email', type: 'text' },
  { key: 'store.phone', label: 'Phone', type: 'text' },
  { key: 'store.phone_alt', label: 'Second phone', type: 'text' },
  { key: 'store.address', label: 'Address', type: 'text' },
  {
    key: 'checkout.reservation_minutes',
    label: 'Hold stock for (minutes)',
    hint: 'How long an unpaid checkout keeps its stock before releasing it.',
    type: 'number',
  },
  {
    key: 'inventory.low_stock_default',
    label: 'Default low-stock warning',
    hint: 'Used for new sizes. Each size can override it.',
    type: 'number',
  },
  {
    key: 'reviews.auto_approve',
    label: 'Publish reviews automatically',
    hint: 'Off means you approve each one first. Recommended.',
    type: 'bool',
  },
];

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<SettingsMap>((t) => api.settings(t));
  const { run, busy } = useAction();

  const [values, setValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'danger' } | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      next[k] = typeof v === 'boolean' ? String(v) : v == null ? '' : String(v);
    }
    setValues(next);
  }, [data]);

  if (loading) return <CardSkeleton rows={6} />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  async function save(key: string, type: 'text' | 'number' | 'bool') {
    setSavingKey(key);
    const raw = values[key] ?? '';
    const parsed: unknown =
      type === 'bool' ? raw === 'true' : type === 'number' ? Number(raw) || 0 : raw;

    const ok = await run((t) => api.updateSetting(t, key, parsed));
    setSavingKey(null);
    if (ok !== null) {
      setToast({ msg: 'Saved.', tone: 'ok' });
      reload();
    }
  }

  const extraKeys = Object.keys(data ?? {}).filter((k) => !KNOWN.some((s) => s.key === k));

  return (
    <>
      <PageHeader title="Settings" subtitle="Each field saves on its own." />

      <div className="space-y-3">
        {KNOWN.filter((s) => s.key in (data ?? {})).map((s) => (
          <div key={s.key} className="ad-card p-4">
            <label htmlFor={s.key} className="ad-label">
              {s.label}
            </label>

            {s.type === 'bool' ? (
              <label className="flex items-center gap-3 text-sm">
                <input
                  id={s.key}
                  type="checkbox"
                  checked={values[s.key] === 'true'}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [s.key]: String(e.target.checked) }))
                  }
                  className="h-5 w-5 accent-[color:var(--color-brand)]"
                />
                {values[s.key] === 'true' ? 'On' : 'Off'}
              </label>
            ) : (
              <input
                id={s.key}
                type={s.type === 'number' ? 'number' : 'text'}
                inputMode={s.type === 'number' ? 'numeric' : undefined}
                value={values[s.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                className={`ad-input ${s.type === 'number' ? 'ad-num' : ''}`}
              />
            )}

            {s.hint ? <p className="ad-hint">{s.hint}</p> : null}

            <button
              type="button"
              onClick={() => save(s.key, s.type)}
              disabled={busy}
              className="ad-btn ad-btn-outline ad-btn-sm mt-3"
            >
              {busy && savingKey === s.key ? <Spinner className="h-3.5 w-3.5" /> : null}
              Save
            </button>
          </div>
        ))}
      </div>

      {extraKeys.length > 0 ? (
        <section className="mt-8">
          <h2 className="ad-eyebrow mb-3">Other settings</h2>
          <div className="space-y-3">
            {extraKeys.map((k) => (
              <div key={k} className="ad-card p-4">
                <label htmlFor={k} className="ad-label ad-mono">
                  {k}
                </label>
                <input
                  id={k}
                  value={values[k] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                  className="ad-input ad-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => save(k, 'text')}
                  disabled={busy}
                  className="ad-btn ad-btn-outline ad-btn-sm mt-3"
                >
                  Save
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {toast ? <Toast message={toast.msg} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}
