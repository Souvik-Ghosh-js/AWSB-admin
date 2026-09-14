'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton, Stars } from '@/components/ui';
import { ApiError, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { formatDate } from '@/lib/format';
import type { Review, ReviewStatus } from '@/lib/types';

const TABS: { value: ReviewStatus; label: string }[] = [
  { value: 'pending', label: 'Awaiting moderation' },
  { value: 'approved', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AdminReviewsPage() {
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const user = getUser();
  const canModerate = can(user, 'reviews.moderate');

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const result = await adminApi.reviews(token, { status });
      setReviews(result.items ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        setReviews([]);
      } else {
        setError(err instanceof ApiError ? err.friendlyMessage : 'Could not load reviews.');
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const moderate = async (review: Review, next: ReviewStatus) => {
    const token = getToken();
    if (!token) return;

    setBusyId(review.id);
    try {
      await adminApi.setReviewStatus(token, review.id, next);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : 'Could not update that review.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <AdminHeading
        title="Reviews"
        description="Only customers with a delivered order can leave one. Nothing is published until you approve it."
      />

      <AdminError message={error} />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            aria-pressed={status === tab.value}
            className={`border px-3.5 py-1.5 text-xs transition-colors ${
              status === tab.value
                ? 'border-brand bg-brand text-[#f7f4ea]'
                : 'border-line-strong text-ink hover:border-brand'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <LineSkeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !reviews || reviews.length === 0 ? (
        <div className="aw-card">
          <AdminEmpty message="Nothing here." />
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="aw-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars rating={review.rating} />
                    {review.isVerifiedPurchase ? (
                      <span className="aw-badge bg-[color-mix(in_srgb,var(--color-brand-soft)_12%,transparent)] text-brand-soft">
                        Verified purchase
                      </span>
                    ) : (
                      <span className="aw-badge bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[#8a6c26]">
                        Unverified
                      </span>
                    )}
                  </div>

                  {review.productName ? (
                    <p className="mt-2 text-xs text-muted">on {review.productName}</p>
                  ) : null}

                  {review.title ? (
                    <h2 className="mt-2 text-lg">{review.title}</h2>
                  ) : null}

                  {review.body ? (
                    <p className="mt-1.5 max-w-2xl text-[0.875rem] leading-relaxed text-ink">
                      {review.body}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-muted">
                    {review.authorName} · {formatDate(review.createdAt)}
                  </p>
                </div>

                {canModerate ? (
                  <div className="flex shrink-0 gap-2">
                    {status !== 'approved' ? (
                      <button
                        type="button"
                        onClick={() => void moderate(review, 'approved')}
                        disabled={busyId === review.id}
                        className="aw-btn aw-btn-primary aw-btn-sm"
                      >
                        Approve
                      </button>
                    ) : null}
                    {status !== 'rejected' ? (
                      <button
                        type="button"
                        onClick={() => void moderate(review, 'rejected')}
                        disabled={busyId === review.id}
                        className="aw-btn aw-btn-danger aw-btn-sm"
                      >
                        Reject
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
