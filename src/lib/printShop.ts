import type { SettingsMap } from './types';

/** The shop's own "from" details for a printed label or invoice, read from Settings. */
export interface PrintShopDetails {
  name: string;
  phone: string;
  phoneAlt: string | null;
  email: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

// store.phone/store.phone_alt/store.address_pincode have at some point been
// saved as raw JSON numbers rather than strings (visible in a direct API
// check: "store.phone":7003356210, no quotes) — a plain typeof === 'string'
// check silently dropped them to the fallback, which is why the shop's own
// phone number was missing from both printed documents even though the
// Settings page showed it and the database genuinely had it.
const str = (v: unknown, fallback = ''): string => {
  if (typeof v === 'string' && v) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fallback;
};

export function readPrintShopDetails(settings: SettingsMap | null): PrintShopDetails {
  const s = settings ?? {};
  return {
    name: str(s['store.name'], 'Attar World Sonar Bangla'),
    phone: str(s['store.phone']),
    phoneAlt: str(s['store.phone_alt']) || null,
    email: str(s['store.email']),
    line1: str(s['store.address_line1']),
    city: str(s['store.address_city']),
    state: str(s['store.address_state']),
    pincode: str(s['store.address_pincode']),
  };
}
