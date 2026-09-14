/**
 * Address and form validation.
 *
 * Deliberately strict, because a vague address is what causes failed
 * deliveries and courier re-attempt fees. Blocking at checkout is cheaper than
 * paying for a returned parcel — so Place Order stays disabled until every
 * required field here passes.
 *
 * Required: full name, phone, email, line1 (house/flat + building), city,
 *           state, 6-digit pincode.
 * Optional: line2 (area/street), landmark, alternate phone.
 */

import type { ShippingAddress } from './types';

/** Exactly 6 digits, never starting with 0. Mirrors the API's PINCODE_RE. */
const PINCODE_RE = /^[1-9][0-9]{5}$/;

/** Indian mobile numbers are 10 digits starting 6-9. */
const MOBILE_RE = /^[6-9][0-9]{9}$/;

/**
 * Pragmatic email check. Deliberately not RFC 5322 — that regex rejects valid
 * addresses and accepts nonsense. The API sends a real email; this only
 * catches typos before the shopper loses their basket to a failed submit.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidPincode(pincode: string): boolean {
  return PINCODE_RE.test(String(pincode ?? '').trim());
}

export function isValidMobile(phone: string): boolean {
  return MOBILE_RE.test(normalisePhone(phone));
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(String(email ?? '').trim());
}

/**
 * Strip spaces, hyphens and a +91 / 0 prefix so "+91 70033 56210",
 * "070033-56210" and "7003356210" all validate identically. Shoppers type
 * their number every way imaginable and none of them are wrong.
 */
export function normalisePhone(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export type AddressField = keyof ShippingAddress;

export type AddressErrors = Partial<Record<AddressField, string>>;

export const EMPTY_ADDRESS: ShippingAddress = {
  fullName: '',
  phone: '',
  altPhone: '',
  email: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  country: 'IN',
};

/**
 * Validate the whole address. Returns a field->message map; empty means valid.
 *
 * Messages are written to be actionable rather than technical: "Enter the
 * 10-digit mobile number" tells the shopper what to do, "invalid phone" does
 * not.
 */
export function validateAddress(address: ShippingAddress): AddressErrors {
  const errors: AddressErrors = {};

  const fullName = address.fullName?.trim() ?? '';
  if (!fullName) {
    errors.fullName = 'Enter the name the parcel should be addressed to.';
  } else if (fullName.length < 3) {
    errors.fullName = 'Please enter the full name.';
  } else if (fullName.length > 160) {
    errors.fullName = 'That name is too long.';
  }

  if (!address.phone?.trim()) {
    errors.phone = 'A phone number is required — couriers call before delivery.';
  } else if (!isValidMobile(address.phone)) {
    errors.phone = 'Enter a 10-digit Indian mobile number.';
  }

  // Optional, but if given it must still be a real number.
  if (address.altPhone && address.altPhone.trim()) {
    if (!isValidMobile(address.altPhone)) {
      errors.altPhone = 'Enter a 10-digit Indian mobile number, or leave this blank.';
    } else if (normalisePhone(address.altPhone) === normalisePhone(address.phone)) {
      errors.altPhone = 'The alternate number should be different from the main one.';
    }
  }

  if (!address.email?.trim()) {
    errors.email = 'We send your order confirmation and tracking here.';
  } else if (!isValidEmail(address.email)) {
    errors.email = 'Check this email address — it does not look right.';
  }

  const line1 = address.line1?.trim() ?? '';
  if (!line1) {
    errors.line1 = 'House / flat number and building name are required.';
  } else if (line1.length < 4) {
    errors.line1 = 'Please include both the house/flat number and the building.';
  } else if (line1.length > 255) {
    errors.line1 = 'This is too long — move part of it to the area/street line.';
  }

  if ((address.line2?.length ?? 0) > 255) {
    errors.line2 = 'This is too long.';
  }

  if ((address.landmark?.length ?? 0) > 160) {
    errors.landmark = 'This is too long.';
  }

  const city = address.city?.trim() ?? '';
  if (!city) {
    errors.city = 'City or town is required.';
  } else if (city.length > 120) {
    errors.city = 'That city name is too long.';
  }

  const state = address.state?.trim() ?? '';
  if (!state) {
    errors.state = 'State is required.';
  }

  if (!address.pincode?.trim()) {
    errors.pincode = 'A 6-digit pincode is required.';
  } else if (!isValidPincode(address.pincode)) {
    errors.pincode = 'Enter a valid 6-digit pincode.';
  }

  return errors;
}

/** True when nothing is left to fix — this gates the Place Order button. */
export function isAddressComplete(address: ShippingAddress): boolean {
  return Object.keys(validateAddress(address)).length === 0;
}

/**
 * Warn when the pincode's state disagrees with the typed state.
 *
 * This catches the classic failure: a Delhi pincode with "Kolkata" typed
 * above it. It WARNS rather than blocks — autofill can be wrong at district
 * boundaries, and the shopper knows their own address better than a lookup
 * table does.
 */
export function stateMismatchWarning(
  typedState: string,
  resolvedState: string | null | undefined
): string | null {
  if (!resolvedState || !typedState.trim()) return null;

  const a = typedState.trim().toLowerCase();
  const b = resolvedState.trim().toLowerCase();
  if (a === b) return null;
  // Tolerate "West Bengal" vs "WEST BENGAL " vs "West  Bengal".
  if (a.replace(/\s+/g, '') === b.replace(/\s+/g, '')) return null;

  return `This pincode is usually in ${resolvedState}, but you have entered ${typedState}. Please check before paying.`;
}

/** The 36 states and union territories, for the state select. */
export const INDIAN_STATES: readonly string[] = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

/**
 * Kolkata zone check, mirrored from the API's shipping_zone_pincodes seed
 * (700001-700199 at ₹49). Used ONLY to show an optimistic hint while the
 * quote request is in flight — the API's quote is authoritative and is what
 * the order snapshots.
 */
export function looksLikeKolkata(pincode: string): boolean {
  const p = String(pincode ?? '').trim();
  if (!isValidPincode(p)) return false;
  return p >= '700001' && p <= '700199';
}

/** Trim every string field before sending the address to the API. */
export function normaliseAddress(address: ShippingAddress): ShippingAddress {
  const trim = (v: string | null | undefined): string => String(v ?? '').trim();
  const optional = (v: string | null | undefined): string | null => {
    const t = trim(v);
    return t === '' ? null : t;
  };

  return {
    fullName: trim(address.fullName),
    phone: normalisePhone(address.phone),
    altPhone: address.altPhone ? normalisePhone(address.altPhone) || null : null,
    email: trim(address.email).toLowerCase(),
    line1: trim(address.line1),
    line2: optional(address.line2),
    landmark: optional(address.landmark),
    city: trim(address.city),
    district: optional(address.district),
    state: trim(address.state),
    pincode: trim(address.pincode),
    country: 'IN',
  };
}

/** Order numbers look like AWSB-2026-00417 and are stored uppercase. */
export function normaliseOrderNumber(value: string): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isPlausibleOrderNumber(value: string): boolean {
  return /^AWSB-\d{4}-\d{3,8}$/.test(normaliseOrderNumber(value));
}
