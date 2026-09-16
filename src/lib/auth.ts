'use client';

import type { AdminUser } from './types';

/**
 * Session storage for the admin JWT.
 *
 * sessionStorage, not an httpOnly cookie: the API lives on a different origin
 * (api.attarworldsonarbangla.com), so this app can never see its Set-Cookie.
 * The trade-off is explicit — a scripting bug in this app could read the token.
 * Mitigations: it dies with the tab, it is never written to a cookie so CSRF is
 * structurally impossible, and every request sends it as an explicit header.
 *
 * The real fix is a first-party cookie once the API is a sibling subdomain;
 * that is a change to this file alone.
 */

const TOKEN_KEY = 'awsb.admin.token';
const USER_KEY = 'awsb.admin.user';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Storage can throw in private mode or when site data is blocked. */
function safeGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* A session that cannot persist still works until the tab closes. */
  }
}

function safeRemove(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = safeGet(TOKEN_KEY);
  if (!token) return null;

  // Check expiry locally so an expired token never causes a pointless request
  // and a confusing error. The server still validates it properly.
  const payload = decodeJwt(token);
  if (payload?.exp && payload.exp * 1000 < Date.now()) {
    clearSession();
    return null;
  }
  return token;
}

export function getUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = safeGet(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AdminUser) {
  safeSet(TOKEN_KEY, token);
  safeSet(USER_KEY, JSON.stringify(user));
  listeners.forEach((fn) => fn());
}

export function clearSession() {
  safeRemove(TOKEN_KEY);
  safeRemove(USER_KEY);
  listeners.forEach((fn) => fn());
}

/** Lets the shell react when a session appears or disappears. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function decodeJwt(token: string): { exp?: number; role?: string } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Role gate. Owner outranks manager outranks staff. */
export function can(user: AdminUser | null, need: 'staff' | 'manager' | 'owner'): boolean {
  if (!user) return false;
  const rank = { staff: 1, manager: 2, owner: 3 };
  return (rank[user.role] ?? 0) >= rank[need];
}
