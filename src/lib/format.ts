/** Money is integer paise everywhere. Never floats — 0.1 + 0.2 !== 0.3. */

/** 45050 → "₹450.50" ; compact drops .00 → "₹450" */
export function money(paise: number, opts: { compact?: boolean } = {}): string {
  const n = Math.round(Number(paise) || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  if (opts.compact && frac === 0) return `${sign}₹${groupIndian(whole)}`;
  return `${sign}₹${groupIndian(whole)}.${String(frac).padStart(2, '0')}`;
}

/** Indian grouping: 1234567 → "12,34,567". */
export function groupIndian(n: number): string {
  const s = String(Math.floor(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

/** Rupees typed into a form → paise for the API. */
export function toPaise(rupees: string | number): number {
  const n = typeof rupees === 'number' ? rupees : Number(String(rupees).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Paise → a value an <input type="number"> can hold. */
export function toRupeeInput(paise: number | null | undefined): string {
  if (paise == null) return '';
  return (paise / 100).toFixed(2).replace(/\.00$/, '');
}

/** "12 ml" / "25 g" / "1 stick" / "35 sticks" — not every product is millilitres. */
export function variantSize(sizeMl: number, sizeUnit: 'ml' | 'g' | 'sticks' = 'ml'): string {
  if (sizeUnit === 'sticks') return `${sizeMl} stick${sizeMl === 1 ? '' : 's'}`;
  return `${sizeMl} ${sizeUnit}`;
}

/** "2026-09-16T04:12:00Z" → "16 Sep, 4:12 pm" */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "3 minutes ago" — for an order feed that is checked repeatedly. */
export function relative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return dateOnly(iso);
}

/** pending_payment → "Pending payment" */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—';
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Substitutes a tracking number into a courier template. */
export function trackingUrl(template: string | null, number: string): string | null {
  if (!template) return null;
  if (!template.includes('{TRACKING_NUMBER}')) return template;
  return template.replace(/\{TRACKING_NUMBER\}/g, encodeURIComponent(number));
}
