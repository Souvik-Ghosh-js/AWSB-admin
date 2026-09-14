/**
 * Admin session handling.
 *
 * ── Why the token is in sessionStorage, and not an httpOnly cookie ──────────
 *
 * A genuinely httpOnly cookie can only be set by the server that issues it.
 * The JWT here is issued by the Express API on a DIFFERENT ORIGIN
 * (api.example.com vs example.com), and this Next.js app is a static/SSR
 * frontend that never sees the API's Set-Cookie for its own domain. So an
 * httpOnly cookie is not available to us without either:
 *
 *   (a) proxying every admin API call through a Next.js route handler that
 *       re-issues its own first-party httpOnly cookie, or
 *   (b) putting the API behind the same apex domain and having it set a
 *       first-party cookie directly.
 *
 * (b) is the right long-term answer and is a deployment change, not a code
 * change — §6 of the architecture puts the API on api.<domain>, so it is a
 * sibling subdomain and a `Domain=.<domain>` cookie would work once the domain
 * is decided. Until then this is the "httpOnly-ish" pattern:
 *
 *   - The token lives in sessionStorage, NOT localStorage. It dies when the
 *     tab closes, which bounds the blast radius of a shared or kiosk machine.
 *   - It is never written to a cookie, so it cannot be sent cross-site and
 *     CSRF is structurally impossible — every admin call is an explicit
 *     Authorization header.
 *   - It is held in a module-level variable and read through one accessor, so
 *     there is exactly one place it is touched and it never leaks into React
 *     state, props, or the server-rendered HTML payload.
 *   - The admin routes send X-Robots-Tag: noindex and Cache-Control: no-store
 *     (see next.config.ts), so no admin response is ever cached by a proxy.
 *   - Expiry is tracked client-side and checked before every call, so a stale
 *     token logs out cleanly instead of producing a wall of 401s.
 *
 * The honest trade-off: sessionStorage is readable by JavaScript, so an XSS
 * bug in /admin could exfiltrate the token. That risk is mitigated, not
 * eliminated — React escapes by default and no admin view uses
 * dangerouslySetInnerHTML. Moving to (b) is the fix, and it is a one-file
 * change here: replace the storage accessors with `credentials: 'include'`.
 */

import type { AdminUser } from './types';

const TOKEN_KEY = 'awsb.admin.token';
const USER_KEY = 'awsb.admin.user';
const EXPIRY_KEY = 'awsb.admin.expires';

export const ADMIN_SESSION_EVENT = 'awsb:admin-session-changed';

/**
 * In-memory copy. This is the primary source; storage is the backup that
 * survives a page refresh within the same tab.
 */
let cachedToken: string | null = null;
let cachedUser: AdminUser | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readStorage(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    // Blocked storage — the in-memory copy still serves this page view.
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Non-fatal: the session simply does not survive a refresh.
  }
}

function clearStorage(key: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Non-fatal.
  }
}

function notify(): void {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT));
  } catch {
    // Non-fatal.
  }
}

/** Decode a JWT's exp claim without verifying it. */
function expiryFromToken(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    const payload: unknown = JSON.parse(json);
    if (payload && typeof payload === 'object' && 'exp' in payload) {
      const exp = Number((payload as { exp: unknown }).exp);
      // exp is seconds since epoch; this codebase works in milliseconds.
      if (Number.isFinite(exp)) return exp * 1000;
    }
    return null;
  } catch {
    // A malformed token is treated as having no expiry claim; the API will
    // reject it on the next call and the 401 handler logs out.
    return null;
  }
}

export function saveSession(token: string, user: AdminUser, expiresInSeconds?: number): void {
  cachedToken = token;
  cachedUser = user;

  const expiry =
    expiryFromToken(token) ??
    (expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : null);

  writeStorage(TOKEN_KEY, token);
  writeStorage(USER_KEY, JSON.stringify(user));
  if (expiry) writeStorage(EXPIRY_KEY, String(expiry));

  notify();
}

/**
 * The token, or null. Returns null for an expired token and clears the
 * session, so a stale tab logs out cleanly rather than firing 401s.
 */
export function getToken(): string | null {
  if (!isBrowser()) return null;

  const token = cachedToken ?? readStorage(TOKEN_KEY);
  if (!token) return null;

  const rawExpiry = readStorage(EXPIRY_KEY);
  if (rawExpiry) {
    const expiry = Number(rawExpiry);
    // 30s of slack so a call started just before expiry is not cut off
    // mid-flight by our own clock.
    if (Number.isFinite(expiry) && Date.now() > expiry - 30_000) {
      clearSession();
      return null;
    }
  }

  cachedToken = token;
  return token;
}

export function getUser(): AdminUser | null {
  if (!isBrowser()) return null;
  if (cachedUser) return cachedUser;

  const raw = readStorage(USER_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'email' in parsed) {
      cachedUser = parsed as AdminUser;
      return cachedUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cachedToken = null;
  cachedUser = null;
  clearStorage(TOKEN_KEY);
  clearStorage(USER_KEY);
  clearStorage(EXPIRY_KEY);
  notify();
}

export function isSignedIn(): boolean {
  return getToken() !== null;
}

/* ------------------------------------------------------------------ roles */

export type Permission =
  | 'orders.view'
  | 'orders.ship'
  | 'orders.cancel'
  | 'products.edit'
  | 'inventory.adjust'
  | 'coupons.edit'
  | 'couriers.edit'
  | 'reviews.moderate'
  | 'settings.edit'
  | 'users.manage';

/**
 * Client-side role gating is a UX affordance, NOT a security boundary. It
 * hides controls the user cannot use so they do not hit a 403. The API
 * re-checks the role on every request, and that check is the real one.
 */
const ROLE_PERMISSIONS: Record<AdminUser['role'], Permission[]> = {
  owner: [
    'orders.view',
    'orders.ship',
    'orders.cancel',
    'products.edit',
    'inventory.adjust',
    'coupons.edit',
    'couriers.edit',
    'reviews.moderate',
    'settings.edit',
    'users.manage',
  ],
  manager: [
    'orders.view',
    'orders.ship',
    'orders.cancel',
    'products.edit',
    'inventory.adjust',
    'coupons.edit',
    'couriers.edit',
    'reviews.moderate',
  ],
  // Staff pack and ship. They cannot cancel an order (which triggers a
  // refund) or change a price.
  staff: ['orders.view', 'orders.ship'],
};

export function can(user: AdminUser | null, permission: Permission): boolean {
  if (!user || !user.isActive) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function subscribeToSession(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(ADMIN_SESSION_EVENT, listener);
  return () => window.removeEventListener(ADMIN_SESSION_EVENT, listener);
}
