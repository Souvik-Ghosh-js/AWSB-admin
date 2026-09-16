'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import { dateTime, humanise } from '@/lib/format';
import {
  CardSkeleton, EmptyState, ErrorBox, PageHeader, Sheet, Spinner, StockPill, Toast,
} from '@/components/ui';
import type { LowStockRow, Movement, Page } from '@/lib/types';

/**
 * Stock.
 *
 * Every change made here writes a row to the inventory ledger with a reason,
 * which is why stock cannot be edited on the product form. "Where did my stock
 * go?" has to stay answerable.
 */
export default function InventoryPage() {
  const [tab, setTab] = useState<'low' | 'history'>('low');
  const [adjusting, setAdjusting] = useState<LowStockRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'danger' } | null>(null);

  const low = useApi<LowStockRow[]>((t) => api.lowStock(t));
  const history = useApi<Page<Movement>>((t) => api.movements(t, { limit: 40 }));

  return (
    <>
      <PageHeader title="Stock" subtitle="Every change is recorded with a reason." />

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('low')}
          aria-pressed={tab === 'low'}
          className={`ad-btn ad-btn-sm ${tab === 'low' ? 'ad-btn-primary' : 'ad-btn-outline'}`}
        >
          Needs restocking
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          aria-pressed={tab === 'history'}
          className={`ad-btn ad-btn-sm ${tab === 'history' ? 'ad-btn-primary' : 'ad-btn-outline'}`}
        >
          History
        </button>
      </div>

      {tab === 'low' ? (
        low.loading ? (
          <CardSkeleton rows={4} />
        ) : low.error ? (
          <ErrorBox message={low.error} onRetry={low.reload} />
        ) : !low.data || low.data.length === 0 ? (
          <EmptyState
            title="Everything is well stocked"
            message="Sizes appear here once they drop to their warning level."
          />
        ) : (
          <div className="space-y-3">
            {low.data.map((row) => (
              <div key={row.variantId} className="ad-card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.productName}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">{row.sizeMl}ml</p>
                  <div className="mt-2">
                    <StockPill qty={row.stockQty} threshold={row.threshold} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjusting(row)}
                  className="ad-btn ad-btn-outline ad-btn-sm shrink-0"
                >
                  Restock
                </button>
              </div>
            ))}
          </div>
        )
      ) : history.loading ? (
        <CardSkeleton rows={5} />
      ) : history.error ? (
        <ErrorBox message={history.error} onRetry={history.reload} />
      ) : !history.data || history.data.items.length === 0 ? (
        <EmptyState
          title="No stock movements yet"
          message="Sales, restocks and manual corrections all appear here."
        />
      ) : (
        <div className="ad-card overflow-hidden">
          <ul className="ad-divide">
            {history.data.items.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`ad-num w-12 shrink-0 text-sm font-semibold ${
                    m.delta > 0 ? 'text-[color:var(--color-ok)]' : 'text-[color:var(--color-danger)]'
                  }`}
                >
                  {m.delta > 0 ? '+' : ''}
                  {m.delta}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {m.productName ?? 'Deleted product'}
                    {m.sizeMl ? ` · ${m.sizeMl}ml` : ''}
                  </p>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    {humanise(m.reason)} · {dateTime(m.createdAt)}
                    {m.note ? ` · ${m.note}` : ''}
                  </p>
                </div>
                <span className="ad-num shrink-0 text-xs text-[color:var(--color-muted)]">
                  → {m.balanceAfter}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {adjusting ? (
        <AdjustSheet
          row={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={(msg) => {
            setToast({ msg, tone: 'ok' });
            low.reload();
            history.reload();
          }}
        />
      ) : null}

      {toast ? <Toast message={toast.msg} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}

function AdjustSheet({
  row,
  onClose,
  onDone,
}: {
  row: LowStockRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { run, busy, error } = useAction();
  const [add, setAdd] = useState('');
  const [note, setNote] = useState('');

  const delta = Number(add) || 0;
  const after = row.stockQty + delta;

  async function submit() {
    if (delta === 0) return;
    const ok = await run((t) =>
      api.adjustStock(t, row.variantId, {
        delta,
        note: note.trim() || (delta > 0 ? 'Restocked' : 'Manual correction'),
      }),
    );
    if (ok !== null) {
      onDone(`${row.productName} ${row.sizeMl}ml is now ${after}.`);
      onClose();
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${row.productName} · ${row.sizeMl}ml`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || delta === 0 || after < 0}
            className="ad-btn ad-btn-primary flex-1"
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Update stock
          </button>
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-md bg-[color:var(--color-surface-alt)] px-4 py-3">
        <span className="text-sm text-[color:var(--color-soft)]">In stock now</span>
        <span className="ad-num text-lg font-semibold">{row.stockQty}</span>
      </div>

      <label htmlFor="add" className="ad-label">
        How many are you adding?
      </label>
      <input
        id="add"
        type="number"
        inputMode="numeric"
        value={add}
        onChange={(e) => setAdd(e.target.value)}
        placeholder="e.g. 20"
        autoFocus
        className="ad-input ad-num text-lg"
      />
      <p className="ad-hint">Use a negative number to correct a count downwards.</p>

      {delta !== 0 ? (
        <p
          className={`mt-3 text-sm font-medium ${
            after < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-ok)]'
          }`}
        >
          {after < 0
            ? 'Stock cannot go below zero.'
            : `New total will be ${after}.`}
        </p>
      ) : null}

      <div className="mt-4">
        <label htmlFor="note" className="ad-label">
          Note (optional)
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. new batch from the distiller"
          className="ad-input"
        />
      </div>

      {error ? <p className="ad-error mt-3">{error}</p> : null}
    </Sheet>
  );
}
