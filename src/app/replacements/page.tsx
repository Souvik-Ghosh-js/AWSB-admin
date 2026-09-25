'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import { dateOnly } from '@/lib/format';
import { CardSkeleton, EmptyState, ErrorBox, PageHeader, Spinner, Toast } from '@/components/ui';
import type { Page, ReplacementRequest } from '@/lib/types';

/**
 * Replacement request moderation. A request lands here after a customer
 * complains about a specific item on a delivered order. The evidence they
 * were asked for — photos and an unboxing video — arrives by email, quoting
 * the request number; this page does not track whether it arrived, so check
 * the inbox before deciding.
 */
export default function ReplacementsPage() {
  const [status, setStatus] = useState('pending');
  const { data, error, loading, reload } = useApi<Page<ReplacementRequest>>(
    (t) => api.replacementRequests(t, { status: status || undefined, limit: 50 }),
    [status],
  );
  const [toast, setToast] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  return (
    <>
      <PageHeader
        title="Replacements"
        subtitle="Check the shop inbox for the customer's photos and unboxing video before deciding."
      />

      <div className="ad-scroll-x -mx-4 mb-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-2 pb-1">
          {[
            { v: 'pending', l: 'Waiting' },
            { v: 'approved', l: 'Approved' },
            { v: 'rejected', l: 'Rejected' },
            { v: '', l: 'All' },
          ].map((f) => (
            <button
              key={f.v}
              type="button"
              onClick={() => setStatus(f.v)}
              aria-pressed={status === f.v}
              className={`ad-btn ad-btn-sm shrink-0 ${status === f.v ? 'ad-btn-primary' : 'ad-btn-outline'}`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={status === 'pending' ? 'Nothing waiting' : 'No replacement requests here'}
          message={
            status === 'pending'
              ? 'New requests appear here for you to review and decide.'
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              deciding={decidingId === r.id}
              onDecide={(next) => setDecidingId(next ? r.id : null)}
              onDecided={(msg) => {
                setToast(msg);
                setDecidingId(null);
                reload();
              }}
            />
          ))}
        </div>
      )}

      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}

function RequestCard({
  request: r,
  deciding,
  onDecide,
  onDecided,
}: {
  request: ReplacementRequest;
  deciding: boolean;
  onDecide: (next: boolean) => void;
  onDecided: (message: string) => void;
}) {
  const { run, busy } = useAction();
  const [note, setNote] = useState('');

  async function decide(next: 'approved' | 'rejected') {
    const ok = await run((t) => api.setReplacementStatus(t, r.id, next, note.trim() || undefined));
    if (ok !== null) {
      onDecided(next === 'approved' ? 'Replacement approved.' : 'Replacement rejected.');
    }
  }

  return (
    <div className="ad-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{r.productName}</p>
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">
            {r.orderNumber} · {r.shipFullName} · {r.shipEmail} · {dateOnly(r.createdAt)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-soft)]">{r.reason}</p>
          {r.adminNote ? (
            <p className="mt-2 text-xs text-[color:var(--color-muted)]">Note: {r.adminNote}</p>
          ) : null}
        </div>
        <span
          className={`ad-pill shrink-0 ${
            r.status === 'approved'
              ? 'ad-pill-ok'
              : r.status === 'rejected'
                ? 'ad-pill-muted'
                : 'ad-pill-warn'
          }`}
        >
          {r.status}
        </span>
      </div>

      {r.status === 'pending' ? (
        deciding ? (
          <div className="mt-3 border-t border-[color:var(--color-line)] pt-3">
            <label htmlFor={`note-${r.id}`} className="ad-label">
              Note to customer (optional)
            </label>
            <textarea
              id={`note-${r.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="ad-input"
              placeholder="Shown in the decision email, e.g. why a request was rejected."
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => decide('approved')}
                disabled={busy}
                className="ad-btn ad-btn-primary ad-btn-sm"
              >
                {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide('rejected')}
                disabled={busy}
                className="ad-btn ad-btn-outline ad-btn-sm"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => onDecide(false)}
                disabled={busy}
                className="ad-btn ad-btn-outline ad-btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => onDecide(true)} className="ad-btn ad-btn-primary ad-btn-sm">
              Decide
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
