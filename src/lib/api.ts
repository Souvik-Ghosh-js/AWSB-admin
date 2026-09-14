/**
 * Typed fetch wrapper for the Express API.
 *
 * The frontend NEVER connects to MySQL and NEVER holds a Razorpay secret. Its
 * only backend is this HTTPS API. Everything the browser is allowed to know is
 * a NEXT_PUBLIC_ variable.
 *
 * Two callers, two behaviours:
 *   - Server components call these from the Node runtime and pass caching
 *     hints, so catalogue pages are statically indexable.
 *   - Client components call the same functions in the browser; the admin
 *     helpers attach the JWT from the auth module.
 */

import type {
  AdminDashboard,
  AdminLoginResult,
  AdminOrderDetail,
  AdminOrderSummary,
  AdminProduct,
  AdminUser,
  AdminUserInput,
  ApiErrorBody,
  AwbScanResult,
  CartLineInput,
  CartValidation,
  Category,
  CheckoutSession,
  CheckoutSessionInput,
  CheckoutVerifyResult,
  Coupon,
  CouponPreview,
  Courier,
  CourierInput,
  Feedback,
  FeedbackInput,
  InventoryMovement,
  LowStockRow,
  Order,
  Paginated,
  PincodeLookup,
  ProductDetail,
  ProductInput,
  ProductSummary,
  RazorpayVerifyInput,
  Review,
  ReviewInput,
  ReviewStatus,
  SettingEntry,
  ShipOrderInput,
  ShippingQuote,
} from './types';

/* --------------------------------------------------------------- config */

/**
 * Base URL including /api/v1. Falls back to localhost so a fresh clone runs
 * without a .env.local; a production build without the variable set is a
 * misconfiguration worth noticing in the console rather than failing silently.
 */
export const API_BASE_URL: string = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

export const RAZORPAY_KEY_ID: string = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

/** Local visual development against src/lib/mock-data.ts. Never on in prod. */
export const USE_MOCKS: boolean = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

/* ---------------------------------------------------------------- error */

/**
 * A failed API call. Carries the HTTP status and the API's own error code so
 * callers can distinguish "not found" from "the API is down" — the difference
 * between a 404 page and an "unavailable, try again" panel.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly fieldErrors: Record<string, string | string[]> | undefined;
  /** True when the request never reached the API (DNS, TLS, offline, timeout). */
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    status: number,
    options: {
      code?: string;
      fieldErrors?: Record<string, string | string[]>;
      isNetworkError?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
    this.isNetworkError = options.isNetworkError ?? false;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Safe to show a shopper: never leaks a stack or an internal code. */
  get friendlyMessage(): string {
    if (this.isNetworkError) {
      return 'We could not reach the store right now. Please check your connection and try again.';
    }
    if (this.status === 429) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (this.status >= 500) {
      return 'Something went wrong at our end. Please try again in a moment.';
    }
    return this.message;
  }
}

/* -------------------------------------------------------------- request */

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Bearer token — admin calls only. */
  token?: string | null;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Seconds. Server components use this for ISR on catalogue pages. */
  revalidate?: number | false;
  tags?: string[];
  /** Abort after this many ms so a hung API cannot hang a page render. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function buildUrl(
  path: string,
  query?: RequestOptions['query']
): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * The single place every API call goes through.
 *
 * Note the deliberate absence of `credentials: 'include'`: the API is on a
 * different origin and auth is a bearer token, not a cookie, so sending
 * credentials would only widen the CORS surface for no benefit.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    token,
    query,
    revalidate,
    tags,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers,
    ...rest
  } = options;

  const url = buildUrl(path, query);

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (body instanceof FormData) {
      // Never set Content-Type for FormData — the boundary must be generated
      // by the runtime.
      payload = body;
    } else {
      finalHeaders['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  // AbortSignal.timeout is available in Node 18+ and every target browser,
  // but guard anyway so an older runtime degrades to "no timeout" rather than
  // throwing at module load.
  const signal =
    rest.signal ??
    (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined);

  const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    ...rest,
    method,
    headers: finalHeaders,
    signal,
  };

  if (payload !== undefined) init.body = payload;

  // Caching: opt in explicitly. Anything money- or account-related must never
  // be cached, so the default when no revalidate is given is no-store.
  if (revalidate !== undefined || tags) {
    init.next = {};
    if (revalidate !== undefined) init.next.revalidate = revalidate;
    if (tags) init.next.tags = tags;
  } else if (method === 'GET') {
    init.cache = 'no-store';
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'TimeoutError';
    throw new ApiError(
      aborted ? 'The store took too long to respond.' : 'Could not reach the store.',
      0,
      { isNetworkError: true, code: aborted ? 'TIMEOUT' : 'NETWORK' }
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // A non-JSON body from a proxy or an nginx error page. Keep the raw text
      // for the message but do not pretend it parsed.
      if (!response.ok) {
        throw new ApiError(
          `Unexpected response from the store (HTTP ${response.status}).`,
          response.status,
          { code: 'BAD_RESPONSE' }
        );
      }
    }
  }

  if (!response.ok) {
    const errBody = (parsed ?? {}) as ApiErrorBody;
    throw new ApiError(
      errBody.message || `Request failed (HTTP ${response.status}).`,
      response.status,
      { code: errBody.code, fieldErrors: errBody.errors }
    );
  }

  return unwrap<T>(parsed);
}

/**
 * The API may wrap payloads in `{ data: … }` or return them bare. Accepting
 * both keeps the client working either way rather than silently rendering
 * `undefined` if the envelope convention shifts.
 */
function unwrap<T>(parsed: unknown): T {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'data' in parsed &&
    Object.keys(parsed).length <= 2
  ) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

/** Swallow a 404 into null. Used where "missing" is an expected outcome. */
export async function apiRequestOrNull<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T | null> {
  try {
    return await apiRequest<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.isNotFound) return null;
    throw err;
  }
}

/* ------------------------------------------------------- public: catalogue */

/** Catalogue pages are indexable, so they are rendered on the server and ISR'd. */
const CATALOGUE_REVALIDATE = 300;

export interface ProductQuery {
  category?: string;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name';
  page?: number;
  limit?: number;
}

export function getProducts(query: ProductQuery = {}): Promise<Paginated<ProductSummary>> {
  return apiRequest<Paginated<ProductSummary>>('/products', {
    query: { ...query },
    revalidate: CATALOGUE_REVALIDATE,
    tags: ['products'],
  });
}

export function getProduct(slug: string): Promise<ProductDetail | null> {
  return apiRequestOrNull<ProductDetail>(`/products/${encodeURIComponent(slug)}`, {
    revalidate: CATALOGUE_REVALIDATE,
    tags: ['products', `product:${slug}`],
  });
}

export function getCategories(): Promise<Category[]> {
  return apiRequest<Category[]>('/categories', {
    revalidate: CATALOGUE_REVALIDATE,
    tags: ['categories'],
  });
}

/** Featured attars for the home page. */
export async function getFeaturedProducts(limit = 6): Promise<ProductSummary[]> {
  const page = await apiRequest<Paginated<ProductSummary>>('/products', {
    query: { featured: true, limit },
    revalidate: CATALOGUE_REVALIDATE,
    tags: ['products'],
  });
  return page.items ?? [];
}

/* ------------------------------------------------------------ public: cart */

/**
 * Re-price and stock-check the cart. The server is the only authority on
 * price — localStorage is shopper-editable and must never be trusted.
 */
export function validateCart(items: CartLineInput[]): Promise<CartValidation> {
  return apiRequest<CartValidation>('/cart/validate', {
    method: 'POST',
    body: { items },
  });
}

export function validateCoupon(
  code: string,
  items: CartLineInput[]
): Promise<CouponPreview> {
  return apiRequest<CouponPreview>('/coupons/validate', {
    method: 'POST',
    body: { code, items },
  });
}

/* -------------------------------------------------------- public: shipping */

/**
 * Live shipping quote driven by the pincode: ₹49 for Kolkata 700001-700199,
 * ₹99 elsewhere. Shown in the order summary before payment.
 */
export function getShippingQuote(
  pincode: string,
  subtotalPaise: number
): Promise<ShippingQuote> {
  return apiRequest<ShippingQuote>('/shipping/quote', {
    query: { pincode, subtotal_paise: subtotalPaise },
  });
}

/** Pincode -> city/district/state, which autofills the address form. */
export function lookupPincode(pincode: string): Promise<PincodeLookup | null> {
  return apiRequestOrNull<PincodeLookup>('/shipping/pincode', {
    query: { pincode },
  });
}

/* -------------------------------------------------------- public: checkout */

export function createCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSession> {
  return apiRequest<CheckoutSession>('/checkout/session', {
    method: 'POST',
    body: input,
  });
}

/**
 * Hand the three Razorpay fields to the API for signature verification.
 * This is only a fast provisional confirmation — the authoritative fulfilment
 * trigger is the order.paid webhook, server-side.
 */
export function verifyCheckout(
  input: RazorpayVerifyInput
): Promise<CheckoutVerifyResult> {
  return apiRequest<CheckoutVerifyResult>('/checkout/verify', {
    method: 'POST',
    body: input,
  });
}

/* ---------------------------------------------------------- public: orders */

/**
 * Guest order lookup. Gated on BOTH the order number and the email the parcel
 * is going to — order numbers are sequential and therefore guessable, so the
 * matching email is what stops one customer reading another's address.
 */
export function trackOrder(orderNumber: string, email: string): Promise<Order | null> {
  return apiRequestOrNull<Order>('/orders/track', {
    query: { order_number: orderNumber, email },
  });
}

/* ------------------------------------------------ public: reviews & contact */

export function submitReview(input: ReviewInput): Promise<{ status: ReviewStatus }> {
  return apiRequest<{ status: ReviewStatus }>('/reviews', {
    method: 'POST',
    body: input,
  });
}

export function submitFeedback(input: FeedbackInput): Promise<{ id: number }> {
  return apiRequest<{ id: number }>('/feedback', {
    method: 'POST',
    body: input,
  });
}

/* ------------------------------------------------------------------ admin */

/**
 * Admin calls all take an explicit token argument rather than reading storage
 * inside the client. That keeps this module usable from a server component and
 * makes the token's path through the app visible at every call site.
 */
export const adminApi = {
  login(email: string, password: string): Promise<AdminLoginResult> {
    return apiRequest<AdminLoginResult>('/admin/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },

  me(token: string): Promise<AdminUser> {
    return apiRequest<AdminUser>('/admin/auth/me', { token });
  },

  dashboard(token: string): Promise<AdminDashboard> {
    return apiRequest<AdminDashboard>('/admin/dashboard', { token });
  },

  /** Categories, for the product editor's category picker. */
  categories(token: string): Promise<Category[]> {
    return apiRequest<Category[]>('/admin/categories', { token });
  },

  /* ---- orders ---- */

  orders(
    token: string,
    query: {
      status?: string;
      from?: string;
      to?: string;
      q?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<Paginated<AdminOrderSummary>> {
    return apiRequest<Paginated<AdminOrderSummary>>('/admin/orders', { token, query });
  },

  order(token: string, id: number | string): Promise<AdminOrderDetail> {
    return apiRequest<AdminOrderDetail>(`/admin/orders/${id}`, { token });
  },

  cancelOrder(token: string, id: number | string, reason: string): Promise<AdminOrderDetail> {
    return apiRequest<AdminOrderDetail>(`/admin/orders/${id}/cancel`, {
      method: 'POST',
      token,
      body: { reason },
    });
  },

  shipOrder(
    token: string,
    id: number | string,
    input: ShipOrderInput
  ): Promise<AdminOrderDetail> {
    return apiRequest<AdminOrderDetail>(`/admin/orders/${id}/ship`, {
      method: 'POST',
      token,
      body: input,
    });
  },

  deliverOrder(token: string, id: number | string): Promise<AdminOrderDetail> {
    return apiRequest<AdminOrderDetail>(`/admin/orders/${id}/deliver`, {
      method: 'POST',
      token,
    });
  },

  /**
   * OCR a label photo. Returns a SUGGESTION that pre-fills an editable field;
   * the caller must never submit it without the admin confirming.
   */
  scanAwb(token: string, file: File, courierId?: number): Promise<AwbScanResult> {
    const form = new FormData();
    form.append('image', file);
    if (courierId != null) form.append('courier_id', String(courierId));
    return apiRequest<AwbScanResult>('/admin/shipments/scan-awb', {
      method: 'POST',
      token,
      body: form,
      // OCR on a large photo is slow; a 15s timeout would abort a good scan.
      timeoutMs: 60_000,
    });
  },

  /* ---- products ---- */

  products(
    token: string,
    query: { q?: string; status?: string; page?: number; limit?: number } = {}
  ): Promise<Paginated<AdminProduct>> {
    return apiRequest<Paginated<AdminProduct>>('/admin/products', { token, query });
  },

  product(token: string, id: number | string): Promise<AdminProduct> {
    return apiRequest<AdminProduct>(`/admin/products/${id}`, { token });
  },

  createProduct(token: string, input: ProductInput): Promise<AdminProduct> {
    return apiRequest<AdminProduct>('/admin/products', {
      method: 'POST',
      token,
      body: input,
    });
  },

  updateProduct(
    token: string,
    id: number | string,
    input: Partial<ProductInput>
  ): Promise<AdminProduct> {
    return apiRequest<AdminProduct>(`/admin/products/${id}`, {
      method: 'PATCH',
      token,
      body: input,
    });
  },

  deleteProduct(token: string, id: number | string): Promise<void> {
    return apiRequest<void>(`/admin/products/${id}`, { method: 'DELETE', token });
  },

  /* ---- inventory ---- */

  /** Manual stock adjustment. The API writes an inventory_movements row. */
  adjustStock(
    token: string,
    variantId: number,
    delta: number,
    reason: string,
    note?: string
  ): Promise<{ stockQty: number }> {
    return apiRequest<{ stockQty: number }>(`/admin/variants/${variantId}/stock`, {
      method: 'PATCH',
      token,
      body: { delta, reason, note },
    });
  },

  lowStock(token: string): Promise<LowStockRow[]> {
    return apiRequest<LowStockRow[]>('/admin/inventory/low-stock', { token });
  },

  movements(
    token: string,
    query: { variant_id?: number; page?: number; limit?: number } = {}
  ): Promise<Paginated<InventoryMovement>> {
    return apiRequest<Paginated<InventoryMovement>>('/admin/inventory/movements', {
      token,
      query,
    });
  },

  /* ---- coupons ---- */

  coupons(token: string): Promise<Paginated<Coupon>> {
    return apiRequest<Paginated<Coupon>>('/admin/coupons', { token });
  },

  createCoupon(token: string, input: Partial<Coupon>): Promise<Coupon> {
    return apiRequest<Coupon>('/admin/coupons', { method: 'POST', token, body: input });
  },

  updateCoupon(token: string, id: number, input: Partial<Coupon>): Promise<Coupon> {
    return apiRequest<Coupon>(`/admin/coupons/${id}`, {
      method: 'PATCH',
      token,
      body: input,
    });
  },

  deleteCoupon(token: string, id: number): Promise<void> {
    return apiRequest<void>(`/admin/coupons/${id}`, { method: 'DELETE', token });
  },

  /* ---- couriers ---- */

  couriers(token: string): Promise<Courier[]> {
    return apiRequest<Courier[]>('/admin/couriers', { token });
  },

  createCourier(token: string, input: CourierInput): Promise<Courier> {
    return apiRequest<Courier>('/admin/couriers', { method: 'POST', token, body: input });
  },

  updateCourier(token: string, id: number, input: Partial<CourierInput>): Promise<Courier> {
    return apiRequest<Courier>(`/admin/couriers/${id}`, {
      method: 'PATCH',
      token,
      body: input,
    });
  },

  deleteCourier(token: string, id: number): Promise<void> {
    return apiRequest<void>(`/admin/couriers/${id}`, { method: 'DELETE', token });
  },

  /* ---- reviews & feedback ---- */

  reviews(
    token: string,
    query: { status?: ReviewStatus; page?: number } = {}
  ): Promise<Paginated<Review>> {
    return apiRequest<Paginated<Review>>('/admin/reviews', { token, query });
  },

  setReviewStatus(token: string, id: number, status: ReviewStatus): Promise<Review> {
    return apiRequest<Review>(`/admin/reviews/${id}/status`, {
      method: 'PATCH',
      token,
      body: { status },
    });
  },

  feedback(
    token: string,
    query: { status?: string; page?: number } = {}
  ): Promise<Paginated<Feedback>> {
    return apiRequest<Paginated<Feedback>>('/admin/feedback', { token, query });
  },

  setFeedbackStatus(token: string, id: number, status: string): Promise<Feedback> {
    return apiRequest<Feedback>(`/admin/feedback/${id}`, {
      method: 'PATCH',
      token,
      body: { status },
    });
  },

  /* ---- settings & users ---- */

  settings(token: string): Promise<SettingEntry[]> {
    return apiRequest<SettingEntry[]>('/admin/settings', { token });
  },

  updateSetting(token: string, keyName: string, value: unknown): Promise<SettingEntry> {
    return apiRequest<SettingEntry>(`/admin/settings/${encodeURIComponent(keyName)}`, {
      method: 'PUT',
      token,
      body: { value },
    });
  },

  users(token: string): Promise<AdminUser[]> {
    return apiRequest<AdminUser[]>('/admin/users', { token });
  },

  createUser(token: string, input: AdminUserInput): Promise<AdminUser> {
    return apiRequest<AdminUser>('/admin/users', { method: 'POST', token, body: input });
  },

  updateUser(token: string, id: number, input: Partial<AdminUserInput>): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin/users/${id}`, {
      method: 'PATCH',
      token,
      body: input,
    });
  },

  deleteUser(token: string, id: number): Promise<void> {
    return apiRequest<void>(`/admin/users/${id}`, { method: 'DELETE', token });
  },
};
