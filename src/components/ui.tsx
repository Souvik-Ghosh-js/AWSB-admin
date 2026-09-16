'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { OrderStatus, PaymentStatus } from '@/lib/types';
import { humanise } from '@/lib/format';

/* ------------------------------------------------------------- feedback */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Every failure a person sees goes through here, so an error always says what
 * went wrong AND offers a way forward.
 */
export function ErrorBox({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="ad-card border-[color:var(--color-danger)]/25 bg-[color:var(--color-danger-bg)] p-5"
    >
      <p className="font-semibold text-[color:var(--color-danger)]">{title}</p>
      <p className="mt-1.5 text-sm text-[color:var(--color-soft)]">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="ad-btn ad-btn-outline ad-btn-sm mt-4">
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="ad-card flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-[color:var(--color-muted)]">{icon}</div> : null}
      <p className="font-semibold">{title}</p>
      {message ? (
        <p className="mt-2 max-w-sm text-sm text-[color:var(--color-muted)]">{message}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`ad-skel ${className}`} aria-hidden="true" />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="ad-card p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={i > 0 ? 'mt-4' : ''}>
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- pills */

/**
 * Status pills carry a WORD, not just a colour — colour alone is invisible to
 * a colour-blind user and washes out in sunlight, which is where a phone
 * running a shop actually gets used.
 */
export function StatusPill({ status }: { status: OrderStatus | string }) {
  const tone: Record<string, string> = {
    pending_payment: 'ad-pill-warn',
    confirmed: 'ad-pill-info',
    packed: 'ad-pill-info',
    shipped: 'ad-pill-info',
    delivered: 'ad-pill-ok',
    cancelled: 'ad-pill-muted',
    refunded: 'ad-pill-muted',
  };
  return <span className={`ad-pill ${tone[status] ?? 'ad-pill-muted'}`}>{humanise(status)}</span>;
}

export function PaymentPill({ status }: { status: PaymentStatus | string }) {
  const tone: Record<string, string> = {
    paid: 'ad-pill-ok',
    pending: 'ad-pill-warn',
    failed: 'ad-pill-danger',
    refunded: 'ad-pill-muted',
    partially_refunded: 'ad-pill-muted',
  };
  return <span className={`ad-pill ${tone[status] ?? 'ad-pill-muted'}`}>{humanise(status)}</span>;
}

export function StockPill({ qty, threshold }: { qty: number; threshold: number }) {
  if (qty <= 0) return <span className="ad-pill ad-pill-danger">Out of stock</span>;
  if (qty <= threshold) return <span className="ad-pill ad-pill-warn">Low · {qty} left</span>;
  return <span className="ad-pill ad-pill-ok">{qty} in stock</span>;
}

/* -------------------------------------------------------------- sheets */

/**
 * Bottom sheet on a phone, centred dialog on a desktop.
 * Escape closes, focus moves in on open, and body scroll is locked so the page
 * behind does not slide around under a thumb.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the panel so a screen reader announces it and Tab stays inside.
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="ad-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="ad-sheet focus:outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-4">
          <h2 className="text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[color:var(--color-muted)] hover:bg-[color:var(--color-surface-alt)]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5">{children}</div>

        {footer ? (
          <div className="sticky bottom-0 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Destructive confirmation. Never a window.confirm — it cannot be styled or read well on a phone. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`ad-btn flex-1 ${danger ? 'ad-btn-danger' : 'ad-btn-primary'}`}
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-[color:var(--color-soft)]">{message}</p>
    </Sheet>
  );
}

/* --------------------------------------------------------------- toast */

export function Toast({
  message,
  tone = 'ok',
  onDismiss,
}: {
  message: string;
  tone?: 'ok' | 'danger';
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4200);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[88px] z-[70] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:max-w-sm"
    >
      <div
        className={`ad-card flex items-start gap-3 px-4 py-3 shadow-[var(--shadow-raised)] ${
          tone === 'danger'
            ? 'border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-bg)]'
            : 'border-[color:var(--color-ok)]/30 bg-[color:var(--color-ok-bg)]'
        }`}
      >
        <p
          className={`flex-1 text-sm font-medium ${
            tone === 'danger' ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-ok)]'
          }`}
        >
          {message}
        </p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-60">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- layout */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Label/value row — the backbone of the card layouts used on phones. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-[color:var(--color-muted)]">{label}</span>
      <span className="min-w-0 text-right text-sm">{children}</span>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="ad-btn ad-btn-outline ad-btn-sm"
      >
        Previous
      </button>
      <span className="ad-num text-xs text-[color:var(--color-muted)]">
        Page {page} of {totalPages} · {total} total
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="ad-btn ad-btn-outline ad-btn-sm"
      >
        Next
      </button>
    </div>
  );
}
