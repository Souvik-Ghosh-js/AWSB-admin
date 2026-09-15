'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminCard, AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton } from '@/components/ui';
import { ApiError, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { formatDateTime } from '@/lib/format';
import type { AdminRole, AdminUser } from '@/lib/types';

const ROLE_NOTES: Record<AdminRole, string> = {
  owner: 'Everything, including settings and other admin users.',
  manager: 'Orders, products, stock, coupons and reviews. Not settings or users.',
  staff: 'Can view orders and ship them. Cannot cancel, refund or change prices.',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AdminRole>('staff');
  const [password, setPassword] = useState('');

  const me = getUser();
  const canManage = can(me, 'users.manage');

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setUsers(await adminApi.users(token));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        setUsers(me ? [me] : []);
      } else {
        setError(err instanceof ApiError ? err.friendlyMessage : 'Could not load admin users.');
      }
    } finally {
      setLoading(false);
    }
    // `me` is read once from storage; it does not change between renders here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const token = getToken();
    if (!token) return;

    if (!email.trim() || !fullName.trim() || !password) {
      setError('Name, email and an initial password are all required.');
      return;
    }
    if (password.length < 12) {
      setError('Use at least 12 characters for the initial password.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await adminApi.createUser(token, {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role,
        isActive: true,
        password,
      });
      setCreating(false);
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('staff');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : 'Could not create that user.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (target: AdminUser) => {
    const token = getToken();
    if (!token) return;

    setBusy(true);
    try {
      await adminApi.updateUser(token, target.id, { isActive: !target.isActive });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : 'Could not update that user.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminHeading
        title="Admin users"
        description="Who can sign in here, and what each of them may do."
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="aw-btn aw-btn-primary aw-btn-sm"
            >
              {creating ? 'Close' : 'Add user'}
            </button>
          ) : null
        }
      />

      <AdminError message={error} />

      {creating ? (
        <AdminCard title="New admin user" className="mb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="u-name" className="aw-label">
                Full name <span className="text-accent">*</span>
              </label>
              <input
                id="u-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="aw-field"
              />
            </div>

            <div>
              <label htmlFor="u-email" className="aw-label">
                Email <span className="text-accent">*</span>
              </label>
              <input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="aw-field"
              />
            </div>

            <div>
              <label htmlFor="u-role" className="aw-label">
                Role
              </label>
              <select
                id="u-role"
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
                className="aw-field"
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
              <p className="aw-hint">{ROLE_NOTES[role]}</p>
            </div>

            <div>
              <label htmlFor="u-password" className="aw-label">
                Initial password <span className="text-accent">*</span>
              </label>
              <input
                id="u-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="aw-field"
              />
              <p className="aw-hint">
                At least 12 characters. Ask them to change it after first sign-in.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="aw-btn aw-btn-primary aw-btn-sm mt-5"
          >
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </AdminCard>
      ) : null}

      <div className="aw-card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }, (_, i) => (
              <LineSkeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !users || users.length === 0 ? (
          <AdminEmpty message="No admin users returned." />
        ) : (
          <div className="overflow-x-auto">
            <table className="aw-table">
              <thead>
                <tr className="border-b border-line bg-surface-alt">
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Name</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Email</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Role</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Last signed in</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-[0.875rem]">
                      {row.fullName}
                      {me?.id === row.id ? (
                        <span className="ml-2 text-xs text-muted">(you)</span>
                      ) : null}
                    </td>
                    <td data-label="Email" className="px-4 py-3 text-[0.8125rem] break-all text-muted">
                      {row.email}
                    </td>
                    <td data-label="Role" className="px-4 py-3">
                      <span className="aw-badge bg-surface-alt text-muted">{row.role}</span>
                    </td>
                    <td data-label="Last signed in" className="px-4 py-3 text-xs text-muted">
                      {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'}
                    </td>
                    <td data-label="Status" className="px-4 py-3">
                      {canManage && me?.id !== row.id ? (
                        <button
                          type="button"
                          onClick={() => void toggleActive(row)}
                          disabled={busy}
                          className={`aw-badge cursor-pointer ${
                            row.isActive
                              ? 'bg-[color-mix(in_srgb,var(--color-brand-soft)_14%,transparent)] text-brand-soft'
                              : 'bg-surface-alt text-muted'
                          }`}
                        >
                          {row.isActive ? 'Active' : 'Disabled'}
                        </button>
                      ) : (
                        <span className="aw-badge bg-surface-alt text-muted">
                          {row.isActive ? 'Active' : 'Disabled'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(Object.keys(ROLE_NOTES) as AdminRole[]).map((r) => (
          <div key={r} className="aw-card p-4">
            <p className="aw-eyebrow mb-1.5">{r}</p>
            <p className="text-xs leading-relaxed text-muted">{ROLE_NOTES[r]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
