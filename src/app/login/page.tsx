'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LogoMark } from '@/components/Logo';
import { ApiError, adminApi } from '@/lib/api';
import { saveSession } from '@/lib/admin-auth';

/**
 * Admin sign-in.
 *
 * The JWT the API returns is stored via lib/admin-auth.ts — see the long
 * comment at the top of that file for why it lives in sessionStorage rather
 * than an httpOnly cookie, and what would change that.
 */
export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await adminApi.login(email.trim().toLowerCase(), password);
      saveSession(result.token, result.user, result.expiresIn);
      // Clear the password from state immediately on success.
      setPassword('');
      router.replace('/');
    } catch (err) {
      // Deliberately generic: distinguishing "no such user" from "wrong
      // password" tells an attacker which admin emails exist.
      setError(
        err instanceof ApiError && err.isUnauthorized
          ? 'Those details were not recognised.'
          : err instanceof ApiError
            ? err.friendlyMessage
            : 'Could not sign in. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12 text-brand" />
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl text-brand">
            Attar World Sonar Bangla
          </h1>
          <p className="aw-eyebrow aw-eyebrow-accent mt-2">Administration</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="aw-card p-6 sm:p-7"
          noValidate
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="admin-email" className="aw-label">
                Email address
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                className="aw-field"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="aw-label">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="aw-field"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="aw-error mt-4">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="aw-btn aw-btn-primary mt-6 w-full"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          This area is for shop staff. Your session ends when you close this tab.
        </p>
      </div>
    </div>
  );
}
