'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton } from '@/components/ui';
import { ApiError, adminApi } from '@/lib/api';
import { getToken } from '@/lib/admin-auth';
import { formatDateTime } from '@/lib/format';
import type { Feedback, FeedbackStatus } from '@/lib/types';

const TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' },
];

export default function AdminFeedbackPage() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const result = await adminApi.feedback(token, status ? { status } : {});
      setItems(result.items ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        setItems([]);
      } else {
        setError(err instanceof ApiError ? err.friendlyMessage : 'Could not load feedback.');
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const setItemStatus = async (item: Feedback, next: FeedbackStatus) => {
    const token = getToken();
    if (!token) return;

    setBusyId(item.id);
    try {
      await adminApi.setFeedbackStatus(token, item.id, next);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : 'Could not update that message.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <AdminHeading title="Feedback" description="Messages sent through the contact form." />

      <AdminError message={error} />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            aria-pressed={status === tab.value}
            className="aw-chip"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <LineSkeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="aw-card">
          <AdminEmpty message="No messages here." />
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="aw-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.875rem] font-medium">
                      {item.name || 'Anonymous'}
                    </span>
                    {item.email ? (
                      <a
                        href={`mailto:${item.email}`}
                        className="text-xs break-all text-brand-soft underline underline-offset-4"
                      >
                        {item.email}
                      </a>
                    ) : null}
                    <span className="aw-badge bg-surface-alt text-muted">{item.status}</span>
                  </div>

                  {item.subject ? (
                    <h2 className="mt-2 text-lg">{item.subject}</h2>
                  ) : null}

                  <p className="mt-1.5 max-w-2xl text-[0.875rem] leading-relaxed whitespace-pre-line text-ink">
                    {item.message}
                  </p>

                  <p className="mt-2 text-xs text-muted">
                    {formatDateTime(item.createdAt)}
                    {item.orderNumber ? ` · ${item.orderNumber}` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.status === 'new' ? (
                    <button
                      type="button"
                      onClick={() => void setItemStatus(item, 'read')}
                      disabled={busyId === item.id}
                      className="aw-btn aw-btn-outline aw-btn-sm"
                    >
                      Mark read
                    </button>
                  ) : null}
                  {item.status !== 'responded' && item.status !== 'closed' ? (
                    <button
                      type="button"
                      onClick={() => void setItemStatus(item, 'responded')}
                      disabled={busyId === item.id}
                      className="aw-btn aw-btn-outline aw-btn-sm"
                    >
                      Mark responded
                    </button>
                  ) : null}
                  {item.status !== 'closed' ? (
                    <button
                      type="button"
                      onClick={() => void setItemStatus(item, 'closed')}
                      disabled={busyId === item.id}
                      className="aw-btn aw-btn-ghost aw-btn-sm"
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
