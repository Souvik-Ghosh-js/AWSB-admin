'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import { dateOnly } from '@/lib/format';
import { CardSkeleton, EmptyState, ErrorBox, PageHeader, Spinner, Toast } from '@/components/ui';
import type { Page, Review } from '@/lib/types';

export default function ReviewsPage() {
  const [status, setStatus] = useState('pending');
  const { data, error, loading, reload } = useApi<Page<Review>>(
    (t) => api.reviews(t, { status: status || undefined, limit: 50 }),
    [status],
  );
  const { run, busy } = useAction();
  const [toast, setToast] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  async function setReview(id: number, next: 'approved' | 'rejected') {
    setActing(id);
    const ok = await run((t) => api.setReviewStatus(t, id, next));
    setActing(null);
    if (ok !== null) {
      setToast(next === 'approved' ? 'Review published.' : 'Review rejected.');
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Nothing appears on the shop until you approve it."
      />

      <div className="ad-scroll-x -mx-4 mb-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-2 pb-1">
          {[
            { v: 'pending', l: 'Waiting' },
            { v: 'approved', l: 'Published' },
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
          title={status === 'pending' ? 'Nothing waiting' : 'No reviews here'}
          message={
            status === 'pending'
              ? 'New reviews appear here for you to approve before they go live.'
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <div key={r.id} className="ad-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Stars rating={r.rating} />
                    {r.isVerifiedPurchase ? (
                      <span className="ad-pill ad-pill-ok">Verified buyer</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-medium">{r.title ?? 'No title'}</p>
                  {r.body ? (
                    <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-soft)]">{r.body}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                    {r.authorName} · {r.productName ?? 'Unknown product'} · {dateOnly(r.createdAt)}
                  </p>
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

              {/* Each button hides itself when it would be a no-op, so an
                  already-approved review offers only "Reject" and vice versa. */}
              <div className="mt-3 flex gap-2">
                  {r.status !== 'approved' ? (
                    <button
                      type="button"
                      onClick={() => setReview(r.id, 'approved')}
                      disabled={busy}
                      className="ad-btn ad-btn-primary ad-btn-sm"
                    >
                      {busy && acting === r.id ? <Spinner className="h-3.5 w-3.5" /> : null}
                      Publish
                    </button>
                  ) : null}
                  {r.status !== 'rejected' ? (
                    <button
                      type="button"
                      onClick={() => setReview(r.id, 'rejected')}
                      disabled={busy}
                      className="ad-btn ad-btn-outline ad-btn-sm"
                    >
                      Reject
                    </button>
                  ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={i <= rating ? 'var(--color-accent)' : 'none'}
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" />
        </svg>
      ))}
    </span>
  );
}
