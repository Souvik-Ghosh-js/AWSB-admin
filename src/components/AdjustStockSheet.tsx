'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction } from '@/lib/useApi';
import { variantSize } from '@/lib/format';
import { Sheet, Spinner } from '@/components/ui';

/** The minimum a stock adjustment needs — a LowStockRow satisfies this, but so does any Variant plus its product. */
export interface AdjustableVariant {
  variantId: number;
  productName: string;
  sizeMl: number;
  sizeUnit: 'ml' | 'g' | 'sticks';
  stockQty: number;
}

/**
 * Add-or-correct stock for one variant, shared by the Inventory "Needs
 * restocking" list and the product edit page's "Stock right now" summary —
 * the latter has no other way to adjust a variant that isn't already low, so
 * zeroing out (or otherwise correcting) a well-stocked size had nowhere to
 * go before this was pulled out and reused there too.
 */
export function AdjustStockSheet({
  row,
  onClose,
  onDone,
}: {
  row: AdjustableVariant;
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
      onDone(`${row.productName} ${variantSize(row.sizeMl, row.sizeUnit)} is now ${after}.`);
      onClose();
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${row.productName} · ${variantSize(row.sizeMl, row.sizeUnit)}`}
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
