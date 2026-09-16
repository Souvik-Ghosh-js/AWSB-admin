'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from './api';
import { clearSession, getToken } from './auth';

/**
 * One hook for every read in the panel.
 *
 * It exists so no page has to hand-roll the same four states (loading, error,
 * empty, data) and get one of them subtly wrong. It also centralises the
 * session-expiry rule: a 401 anywhere signs the user out and bounces to login,
 * rather than each page inventing its own handling.
 */
export function useApi<T>(
  fetcher: (token: string) => Promise<T>,
  deps: unknown[] = [],
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
} {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    setError(null);

    fetcher(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.isAuthError) {
          clearSession();
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load this page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  return { data, error, loading, reload };
}

/**
 * Companion for writes. Returns a runner that surfaces a friendly message
 * instead of throwing into an event handler, where React would swallow it.
 */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(fn: (token: string) => Promise<T>): Promise<T | null> => {
      const token = getToken();
      if (!token) {
        router.replace('/login');
        return null;
      }
      setBusy(true);
      setError(null);
      try {
        return await fn(token);
      } catch (err) {
        if (err instanceof ApiError && err.isAuthError) {
          clearSession();
          router.replace('/login');
          return null;
        }
        setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return { run, busy, error, clearError: () => setError(null) };
}
