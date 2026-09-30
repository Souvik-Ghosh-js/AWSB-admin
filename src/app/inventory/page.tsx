'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { dateTime, humanise, variantSize } from '@/lib/format';
import { CardSkeleton, EmptyState, ErrorBox, PageHeader, StockPill, Toast } from '@/components/ui';
import { AdjustStockSheet } from '@/components/AdjustStockSheet';
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
                  <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">{variantSize(row.sizeMl, row.sizeUnit)}</p>
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
                    {m.sizeMl ? ` · ${variantSize(m.sizeMl, m.sizeUnit)}` : ''}
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
        <AdjustStockSheet
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

