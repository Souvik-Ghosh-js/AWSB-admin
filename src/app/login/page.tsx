'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { api } from '@/lib/api';
import { saveSession } from '@/lib/auth';
import { Spinner } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, admin } = await api.login(email.trim(), password);
      saveSession(token, admin);
      // Clear the password from React state the moment it is no longer needed.
      setPassword('');
      router.replace('/');
    } catch (err) {
      // Deliberately generic — distinguishing "no such account" from "wrong
      // password" tells an attacker which admin emails exist.
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-brand)]">
            Attar World
          </h1>
          <p className="ad-eyebrow mt-2">Admin panel</p>
        </div>

        <form onSubmit={onSubmit} className="ad-card p-6">
          <div>
            <label htmlFor="email" className="ad-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ad-input"
            />
          </div>

          <div className="mt-4">
            <label htmlFor="password" className="ad-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ad-input"
            />
          </div>

          {error ? (
            <p role="alert" className="ad-error mt-4">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="ad-btn ad-btn-primary mt-6 w-full">
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[color:var(--color-muted)]">
          Staff access only. All actions are logged.
        </p>
      </div>
    </div>
  );
}
