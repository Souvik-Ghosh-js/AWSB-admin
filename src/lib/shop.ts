/**
 * Shop constants. The real details of the business, in one place.
 *
 * NOT GST REGISTERED — there is no GSTIN, no HSN code and no tax breakdown
 * anywhere in this app. Prices are final and receipts are plain receipts.
 * If registration happens later, that is a deliberate change here and in the
 * API, not something to be quietly added to a template.
 */

export const SHOP = {
  name: 'Attar World Sonar Bangla',
  shortName: 'Attar World',
  tagline: 'Sonar Bangla',
  description:
    'A Kolkata attar house offering alcohol-free perfume oils in 3ml, 6ml and 12ml — oud, rose, musk and amber, decanted by hand in Rajarhat.',

  address: {
    line1: 'Dashadrone',
    line2: 'Rajarhat',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700136',
    country: 'India',
  },

  /** Single line, for footers and policy pages. */
  addressLine: 'Dashadrone, Rajarhat, Kolkata, West Bengal 700136, India',

  email: 'sangatdutta65@gmail.com',
  phones: ['7003356210', '9038571860'] as const,
  primaryPhone: '7003356210',

  hours: 'Monday to Saturday, 10am – 7pm IST',

  /** Shipping rates — mirrors shipping_zones. Authoritative value is the API's. */
  shipping: {
    kolkataPaise: 4900,
    restOfIndiaPaise: 9900,
    kolkataRangeStart: '700001',
    kolkataRangeEnd: '700199',
    dispatchDays: '1–2 business days',
    deliveryKolkata: '2–4 business days',
    deliveryIndia: '4–8 business days',
  },

  /** Returns window, quoted on the refund policy and the product page. */
  returnWindowDays: 7,

  /** Stock is held this long while payment completes. Mirrors RESERVATION_MINUTES. */
  reservationMinutes: 30,
} as const;

export const SIZES_ML = [3, 6, 12] as const;
export type SizeMl = (typeof SIZES_ML)[number];

/** Storefront navigation. */
export const NAV_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'Our House' },
  { href: '/track', label: 'Track Order' },
  { href: '/contact', label: 'Contact' },
] as const;

export const POLICY_LINKS = [
  { href: '/policies/terms', label: 'Terms & Conditions' },
  { href: '/policies/privacy', label: 'Privacy Policy' },
  { href: '/policies/refund', label: 'Refund & Cancellation' },
  { href: '/policies/shipping', label: 'Shipping Policy' },
] as const;

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A–Z' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export function isSortValue(value: string | undefined): value is SortValue {
  return SORT_OPTIONS.some((o) => o.value === value);
}
