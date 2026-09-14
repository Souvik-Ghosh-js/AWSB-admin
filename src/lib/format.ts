/**
 * Money and display formatting.
 *
 * All money crossing the API boundary is an INTEGER NUMBER OF PAISE, never a
 * float — ₹450.00 is 45000. This mirrors api/src/utils/money.js exactly so the
 * two sides never disagree about a rupee.
 */

/** Indian digit grouping: 1234567 -> "12,34,567". */
export function groupIndian(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

export interface FormatPaiseOptions {
  /** Currency symbol. */
  symbol?: string;
  /**
   * Drop ".00" on whole-rupee amounts. Attar prices are almost always whole
   * rupees, and "₹450" reads cleaner on a product card than "₹450.00".
   */
  compact?: boolean;
}

/**
 * 45000 -> "₹450.00" (or "₹450" with compact).
 *
 * Deliberately hand-rolled rather than Intl.NumberFormat: the same function
 * runs during server rendering, and a minimal Node build without full ICU
 * silently formats en-IN with Western grouping (1,234,567), which would look
 * wrong on an Indian storefront.
 */
export function formatPaise(
  paise: number | null | undefined,
  { symbol = '₹', compact = false }: FormatPaiseOptions = {}
): string {
  const n = Number(paise);
  if (!Number.isFinite(n)) return `${symbol}0`;

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;

  if (compact && frac === 0) {
    return `${sign}${symbol}${groupIndian(whole)}`;
  }

  return `${sign}${symbol}${groupIndian(whole)}.${String(frac).padStart(2, '0')}`;
}

/** 45000 -> 450.5 — only for display maths, never for money arithmetic. */
export function paiseToRupees(paise: number): number {
  return Number(paise) / 100;
}

/** ₹450.50 -> 45050. */
export function rupeesToPaise(rupees: number | string): number {
  return Math.round(Number(rupees) * 100);
}

/**
 * Format a UTC timestamp from the API for an Indian reader.
 * The API stores and returns UTC; customers read IST.
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
      ...opts,
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Date with time, for order timelines and admin tables. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  return formatDate(value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** "3 ml" — a hair space before the unit reads better than "3ml". */
export function formatSize(sizeMl: number): string {
  return `${sizeMl} ml`;
}

/** 7003356210 -> "70033 56210", the way Indian numbers are read aloud. */
export function formatPhone(phone: string | null | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return String(phone ?? '');
}

/** Percentage saved, for a struck-through compare-at price. */
export function discountPercent(
  pricePaise: number,
  compareAtPaise: number | null | undefined
): number | null {
  if (compareAtPaise == null) return null;
  if (compareAtPaise <= pricePaise) return null;
  return Math.round(((compareAtPaise - pricePaise) / compareAtPaise) * 100);
}

/** Truncate on a word boundary, for meta descriptions and card copy. */
export function truncate(text: string | null | undefined, max = 160): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Strip markdown to plain text. Product descriptions are authored as markdown
 * (products.description is MEDIUMTEXT holding markdown); meta descriptions and
 * JSON-LD must not contain the syntax characters.
 */
export function stripMarkdown(md: string | null | undefined): string {
  return String(md ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Human label for an order status enum value. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
};

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return ORDER_STATUS_LABEL[status] ?? status;
}

export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

/** Pluralise a countable noun without a library. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}
