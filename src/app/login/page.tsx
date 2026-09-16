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
      setPassword('');
      router.replace('/');
    } catch (err) {
      // Same message for "no such account" and "wrong password" — anything
      // else tells an attacker which admin emails exist.
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-chrome)] lg:flex-row">
      {/* Brand panel — full-bleed dark green, the mark large, one line of copy. */}
      <div className="flex flex-col justify-end px-6 pb-8 pt-14 text-[color:var(--color-on-chrome)] lg:flex-1 lg:justify-center lg:px-20">
        {/* The real company mark, not the placeholder flame. */}
        <img
          src="/logo-mark.png"
          alt=""
          aria-hidden="true"
          width={72}
          height={72}
          className="h-[4.5rem] w-[4.5rem]"
        />
        <h1 className="mt-6 text-4xl text-white lg:text-5xl">Attar World</h1>
        <p className="ad-eyebrow mt-3 text-[color:var(--color-accent)]">Admin panel</p>
        <p className="mt-6 hidden max-w-sm text-base text-[color:var(--color-on-chrome-dim)] lg:block">
          Orders, stock, shipping and the shelf — all from one place, on any screen.
        </p>
      </div>

      {/* Form panel — white, rounded top on phones like a sheet. */}
      <div className="flex-1 rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface)] px-6 py-10 lg:flex lg:max-w-xl lg:items-center lg:rounded-none lg:px-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <h2 className="text-2xl">Sign in</h2>

          <div className="mt-6">
            <label htmlFor="email" className="ad-label">Email</label>
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
            <label htmlFor="password" className="ad-label">Password</label>
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
            <p role="alert" className="ad-error mt-4">{error}</p>
          ) : null}

          <button type="submit" disabled={busy} className="ad-btn ad-btn-primary mt-7 w-full text-base">
            {busy ? <Spinner className="h-5 w-5" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-6 text-xs font-semibold text-[color:var(--color-muted)]">
            Staff access only. All actions are logged.
          </p>
        </form>
      </div>
    </div>
  );
}
