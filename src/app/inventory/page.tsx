'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { AdminCard, AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton } from '@/components/ui';
import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { formatDateTime } from '@/lib/format';
import { mockDashboard } from '@/lib/mock-data';
import type { InventoryMovement, LowStockRow, MovementReason } from '@/lib/types';

const REASONS: { value: MovementReason; label: string }[] = [
  { value: 'restock', label: 'Restock' },
  { value: 'manual_adjustment', label: 'Manual adjustment' },
  { value: 'damage', label: 'Damage / breakage' },
];

/**
 * Inventory: what is running out, and the ledger explaining where stock went.
 *
 * inventory_movements is append-only — stock is never adjusted without a row
 * being written, which is what makes "where did my stock go?" answerable.
 */
export default function AdminInventoryPage() {
  const [lowStock, setLowStock] = useState<LowStockRow[] | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [adjusting, setAdjusting] = useState<LowStockRow | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<MovementReason>('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const user = getUser();

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const [low, moves] = await Promise.all([
        adminApi.lowStock(token),
        adminApi.movements(token, { limit: 40 }),
      ]);
      setLowStock(low);
      setMovements(moves.items ?? []);
      setError(null);
    } catch (err) {
      if (USE_MOCKS || (err instanceof ApiError && err.isNetworkError)) {
        setLowStock(mockDashboard.lowStock);
        setMovements([]);
      } else {
        setError(
          err instanceof ApiError ? err.friendlyMessage : 'Could not load inventory.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAdjustment = async () => {
    const token = getToken();
    if (!token || !adjusting) return;

    const value = Number(delta);
    if (!Number.isFinite(value) || value === 0) {
      setError('Enter how many units to add (or remove, with a minus sign).');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await adminApi.adjustStock(
        token,
        adjusting.variantId,
        Math.trunc(value),
        reason,
        note.trim() || undefined
      );
      setAdjusting(null);
      setDelta('');
      setNote('');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.friendlyMessage : 'Could not adjust that stock.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminHeading
        title="Inventory"
        description="Low stock first, then every movement that got you here."
      />

      <AdminError message={error} />

      {loading ? (
        <LineSkeleton className="h-80" />
      ) : (
        <div className="space-y-5">
          <AdminCard title="Running low">
            {!lowStock || lowStock.length === 0 ? (
              <AdminEmpty message="Nothing is below its low-stock threshold." />
            ) : (
              <div className="overflow-x-auto">
                <table className="aw-table">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">Fragrance</th>
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">Size</th>
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">SKU</th>
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-right text-[0.5625rem]">In stock</th>
                      <th scope="col" className="aw-eyebrow py-2 text-right text-[0.5625rem]">Adjust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((row) => (
                      <tr key={row.variantId} className="border-b border-line last:border-0">
                        <td className="py-3 pr-3 text-[0.8125rem]">
                          <Link
                            href={`/products/${row.productId}`}
                            className="text-brand underline-offset-4 hover:underline"
                          >
                            {row.productName}
                          </Link>
                        </td>
                        <td data-label="Size" className="py-3 pr-3 text-[0.8125rem]">{row.sizeMl} ml</td>
                        <td data-label="SKU" className="aw-tabular py-3 pr-3 text-xs text-muted">{row.sku}</td>
                        <td
                          data-label="In stock"
                          className={`aw-tabular py-3 pr-3 text-right text-[0.8125rem] ${
                            row.stockQty === 0 ? 'text-danger' : 'text-[#8a6c26]'
                          }`}
                        >
                          {row.stockQty}
                        </td>
                        <td className="py-3 text-right">
                          {can(user, 'inventory.adjust') ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAdjusting(row);
                                setDelta('');
                                setNote('');
                                setReason('restock');
                              }}
                              className="aw-btn aw-btn-outline aw-btn-sm"
                            >
                              Adjust
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>

          <AdminCard title="Recent movements">
            {!movements || movements.length === 0 ? (
              <AdminEmpty message="No stock movements recorded yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="aw-table">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">When</th>
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">Item</th>
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-[0.5625rem]">Reason</th>
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-right text-[0.5625rem]">Change</th>
                      <th scope="col" className="aw-eyebrow py-2 pr-3 text-right text-[0.5625rem]">Balance</th>
                      <th scope="col" className="aw-eyebrow py-2 text-[0.5625rem]">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((move) => (
                      <tr key={move.id} className="border-b border-line last:border-0">
                        <td className="py-2.5 pr-3 text-xs text-muted">
                          {formatDateTime(move.createdAt)}
                        </td>
                        <td data-label="Item" className="py-2.5 pr-3 text-[0.8125rem]">
                          {move.productName}
                          <span className="text-muted"> · {move.sizeMl} ml</span>
                        </td>
                        <td data-label="Reason" className="py-2.5 pr-3 text-xs text-muted">
                          {move.reason.replace(/_/g, ' ')}
                          {move.orderNumber ? ` · ${move.orderNumber}` : ''}
                        </td>
                        <td
                          data-label="Change"
                          className={`aw-tabular py-2.5 pr-3 text-right text-[0.8125rem] ${
                            move.delta < 0 ? 'text-danger' : 'text-brand-soft'
                          }`}
                        >
                          {move.delta > 0 ? `+${move.delta}` : move.delta}
                        </td>
                        <td data-label="Balance" className="aw-tabular py-2.5 pr-3 text-right text-[0.8125rem]">
                          {move.balanceAfter}
                        </td>
                        <td data-label="By" className="py-2.5 text-xs text-muted">
                          {move.actorEmail ?? 'system'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>
        </div>
      )}

      {/* ---------------------------------------------- adjustment dialog */}
      {adjusting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-ink)_45%,transparent)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="adjust-title"
            className="aw-card w-full max-w-md p-6"
          >
            <h2 id="adjust-title" className="text-xl">
              Adjust stock
            </h2>
            <p className="mt-1 text-[0.8125rem] text-muted">
              {adjusting.productName} · {adjusting.sizeMl} ml · currently{' '}
              {adjusting.stockQty} in stock
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="adj-delta" className="aw-label">
                  Change by <span className="text-accent">*</span>
                </label>
                <input
                  id="adj-delta"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ''))}
                  inputMode="numeric"
                  className="aw-field aw-tabular"
                  placeholder="e.g. 50 to add, -2 to remove"
                />
                {delta && Number.isFinite(Number(delta)) ? (
                  <p className="aw-hint">
                    New balance: {adjusting.stockQty + Math.trunc(Number(delta))}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="adj-reason" className="aw-label">
                  Reason
                </label>
                <select
                  id="adj-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as MovementReason)}
                  className="aw-field"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="adj-note" className="aw-label">
                  Note
                </label>
                <input
                  id="adj-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="aw-field"
                  placeholder="Optional, but future-you will thank you"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => void submitAdjustment()}
                disabled={busy || !delta}
                className="aw-btn aw-btn-primary sm:flex-1"
              >
                {busy ? 'Saving…' : 'Record adjustment'}
              </button>
              <button
                type="button"
                onClick={() => setAdjusting(null)}
                disabled={busy}
                className="aw-btn aw-btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
