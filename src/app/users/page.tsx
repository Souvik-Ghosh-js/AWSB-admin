'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { can, getUser } from '@/lib/auth';
import { useAction, useApi } from '@/lib/useApi';
import { dateTime } from '@/lib/format';
import {
  CardSkeleton, ConfirmSheet, EmptyState, ErrorBox, PageHeader, Sheet, Spinner, Toast,
} from '@/components/ui';
import type { AdminUser } from '@/lib/types';

export default function UsersPage() {
  const { data, error, loading, reload } = useApi<AdminUser[]>((t) => api.users(t));
  const { run, busy } = useAction();

  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'danger' } | null>(null);

  const me = typeof window !== 'undefined' ? getUser() : null;
  const isOwner = can(me, 'owner');

  const activeOwners = (data ?? []).filter((u) => u.role === 'owner' && u.isActive).length;

  async function doDelete() {
    if (!deleting) return;
    const ok = await run((t) => api.deleteUser(t, deleting.id));
    setDeleting(null);
    if (ok !== null) {
      setToast({ msg: `${deleting.email} removed.`, tone: 'ok' });
      reload();
    }
  }

  if (!isOwner) {
    return (
      <>
        <PageHeader title="Staff" />
        <EmptyState
          title="Owners only"
          message="Only an owner can add or remove staff accounts. Ask the shop owner if you need access."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Who can sign in to this panel."
        action={
          <button type="button" onClick={() => setAdding(true)} className="ad-btn ad-btn-primary">
            Add person
          </button>
        }
      />

      {loading ? (
        <CardSkeleton rows={3} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No staff accounts" />
      ) : (
        <div className="space-y-3">
          {data.map((u) => {
            // Refuse to delete the last active owner, or yourself — either would
            // lock everyone out of the panel.
            const isLastOwner = u.role === 'owner' && u.isActive && activeOwners <= 1;
            const isSelf = me?.id === u.id;

            return (
              <div key={u.id} className="ad-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {u.fullName}
                      {isSelf ? (
                        <span className="ml-2 text-xs font-normal text-[color:var(--color-muted)]">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 break-all text-xs text-[color:var(--color-muted)]">{u.email}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                      Last signed in {dateTime(u.lastLoginAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="ad-pill ad-pill-muted">{u.role}</span>
                    {!u.isActive ? <span className="ad-pill ad-pill-danger">Disabled</span> : null}
                  </div>
                </div>

                {!isSelf && !isLastOwner ? (
                  <button
                    type="button"
                    onClick={() => setDeleting(u)}
                    className="ad-btn ad-btn-ghost ad-btn-sm mt-3 text-[color:var(--color-danger)]"
                  >
                    Remove
                  </button>
                ) : isLastOwner ? (
                  <p className="ad-hint mt-3">
                    The last owner cannot be removed — someone must keep full access.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <AddUserSheet
          onClose={() => setAdding(false)}
          onSaved={(msg) => {
            setToast({ msg, tone: 'ok' });
            reload();
          }}
        />
      ) : null}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        busy={busy}
        danger
        title={`Remove ${deleting?.fullName ?? ''}?`}
        message="They lose access to this panel immediately. Anything they already did stays recorded."
        confirmLabel="Remove"
      />

      {toast ? <Toast message={toast.msg} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}

function AddUserSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { run, busy, error } = useAction();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'manager' | 'owner'>('staff');

  const valid =
    fullName.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
    password.length >= 12;

  async function save() {
    const ok = await run((t) =>
      api.createUser(t, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      }),
    );
    if (ok !== null) {
      setPassword('');
      onSaved(`${email.trim()} can now sign in.`);
      onClose();
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Add a person"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy || !valid} className="ad-btn ad-btn-primary flex-1">
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Add
          </button>
        </div>
      }
    >
      <div>
        <label htmlFor="fname" className="ad-label">Name</label>
        <input id="fname" value={fullName} onChange={(e) => setFullName(e.target.value)} className="ad-input" />
      </div>

      <div className="mt-4">
        <label htmlFor="uemail" className="ad-label">Email</label>
        <input
          id="uemail"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ad-input"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="upass" className="ad-label">Password</label>
        <input
          id="upass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="ad-input"
        />
        <p className="ad-hint">
          At least 12 characters. Tell them in person — this is the only time it is shown.
        </p>
        {password.length > 0 && password.length < 12 ? (
          <p className="ad-error">Needs {12 - password.length} more character(s).</p>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor="urole" className="ad-label">Access level</label>
        <select
          id="urole"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="ad-select"
        >
          <option value="staff">Staff — orders and stock</option>
          <option value="manager">Manager — also cancels and refunds</option>
          <option value="owner">Owner — everything, including staff</option>
        </select>
      </div>

      {error ? <p className="ad-error mt-3">{error}</p> : null}
    </Sheet>
  );
}
