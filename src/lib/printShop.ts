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

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v ? v : fallback);

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
