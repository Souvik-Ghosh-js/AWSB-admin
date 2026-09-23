'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { relative } from '@/lib/format';
import type { AdminNotification } from '@/lib/types';

const POLL_MS = 20_000;

/** Where a notification's entity_type points, if we have a page for it. */
function entityHref(n: AdminNotification): string | null {
  if (n.entityType === 'order' && n.entityId) return `/orders/${n.entityId}`;
  if (n.entityType === 'variant' && n.entityId) return '/inventory';
  return null;
}

/**
 * The admin bell. Polls /admin/notifications every 20s rather than opening a
 * socket — this panel has at most two or three admins at once, so the extra
 * infrastructure a websocket needs is not worth it for "a new order every
 * few minutes at best".
 *
 * The chime plays only when the unread count goes UP between polls, never on
 * every poll and never on first load — otherwise every page refresh (and
 * every admin who opens the panel with 40 unread notifications already
 * sitting there from before) would sound like a fresh order.
 */
export function NotificationBell({ variant = 'light' }: { variant?: 'light' | 'chrome' }) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUnreadRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const page = await api.notifications(token, { limit: 15 });
      setItems(page.items);
      setUnread(page.unread);

      // Only chime once we have a real previous reading to compare against,
      // and only when it went up — a mark-all-read elsewhere would drop the
      // count, which must never trigger a sound.
      if (lastUnreadRef.current !== null && page.unread > lastUnreadRef.current) {
        audioRef.current?.play().catch(() => {
          // Autoplay can be blocked before the admin has interacted with the
          // page at all. Nothing to do — the badge still updates silently.
        });
      }
      lastUnreadRef.current = page.unread;
    } catch {
      // A failed poll is not worth surfacing as an error toast; it just
      // tries again next interval.
    }
  }, []);

  useEffect(() => {
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markRead(n: AdminNotification) {
    if (n.isRead) return;
    const token = getToken();
    if (!token) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.readNotification(token, n.id);
    } catch {
      void poll();
    }
  }

  async function markAllRead() {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      await api.readAllNotifications(token);
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a chime, not spoken content */}
      <audio ref={audioRef} src="/notify.wav" preload="auto" />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
          variant === 'chrome'
            ? 'text-[color:var(--color-on-chrome-dim)] hover:bg-[color:var(--color-chrome-raised)] hover:text-white'
            : 'text-[color:var(--color-soft)] hover:bg-[color:var(--color-surface-alt)] hover:text-[color:var(--color-ink)]'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-accent)] px-1 text-[0.625rem] font-bold text-[color:var(--color-brand-deep)]"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                disabled={loading}
                className="text-xs font-medium text-[color:var(--color-brand)] underline underline-offset-4 disabled:opacity-50"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[color:var(--color-muted)]">
                Nothing yet.
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--color-line)]">
                {items.map((n) => {
                  const href = entityHref(n);
                  const body = (
                    <div
                      className={`flex gap-3 px-4 py-3 ${
                        n.isRead ? '' : 'bg-[color:var(--color-brand-tint)]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.isRead ? 'bg-transparent' : 'bg-[color:var(--color-accent)]'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.body ? (
                          <p className="mt-0.5 truncate text-xs text-[color:var(--color-muted)]">
                            {n.body}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[0.6875rem] text-[color:var(--color-muted)]">
                          {relative(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );

                  return (
                    <li key={n.id}>
                      {href ? (
                        <Link
                          href={href}
                          onClick={() => {
                            void markRead(n);
                            setOpen(false);
                          }}
                          className="block hover:bg-[color:var(--color-surface-alt)]"
                        >
                          {body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void markRead(n)}
                          className="block w-full text-left hover:bg-[color:var(--color-surface-alt)]"
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
