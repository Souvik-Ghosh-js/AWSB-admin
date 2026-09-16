'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import { dateTime, humanise } from '@/lib/format';
import { CardSkeleton, EmptyState, ErrorBox, PageHeader, Toast } from '@/components/ui';
import type { Feedback, Page } from '@/lib/types';

export default function FeedbackPage() {
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi<Page<Feedback>>(
    (t) => api.feedback(t, { status: status || undefined, limit: 50 }),
    [status],
  );
  const { run } = useAction();
  const [toast, setToast] = useState<string | null>(null);

  async function mark(id: number, next: string) {
    const ok = await run((t) => api.setFeedbackStatus(t, id, next));
    if (ok !== null) {
      setToast(`Marked ${next}.`);
      reload();
    }
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="Sent from the contact form on the shop." />

      <div className="ad-scroll-x -mx-4 mb-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-2 pb-1">
          {[
            { v: '', l: 'All' },
            { v: 'new', l: 'New' },
            { v: 'read', l: 'Read' },
            { v: 'responded', l: 'Replied' },
            { v: 'closed', l: 'Closed' },
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
        <EmptyState title="No messages" message="Anything sent through the contact form lands here." />
      ) : (
        <div className="space-y-3">
          {data.items.map((f) => (
            <div key={f.id} className="ad-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{f.subject ?? 'No subject'}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                    {f.name ?? 'Anonymous'}
                    {f.email ? ` · ${f.email}` : ''} · {dateTime(f.createdAt)}
                  </p>
                </div>
                <span className={`ad-pill shrink-0 ${f.status === 'new' ? 'ad-pill-warn' : 'ad-pill-muted'}`}>
                  {humanise(f.status)}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-soft)]">
                {f.message}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {f.email ? (
                  <a
                    href={`mailto:${f.email}?subject=${encodeURIComponent(`Re: ${f.subject ?? 'Your message'}`)}`}
                    onClick={() => mark(f.id, 'responded')}
                    className="ad-btn ad-btn-primary ad-btn-sm"
                  >
                    Reply by email
                  </a>
                ) : null}
                {f.status === 'new' ? (
                  <button type="button" onClick={() => mark(f.id, 'read')} className="ad-btn ad-btn-outline ad-btn-sm">
                    Mark read
                  </button>
                ) : null}
                {f.status !== 'closed' ? (
                  <button type="button" onClick={() => mark(f.id, 'closed')} className="ad-btn ad-btn-ghost ad-btn-sm">
                    Close
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
