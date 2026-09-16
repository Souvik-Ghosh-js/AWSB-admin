import type {
  AdminNotification, AdminUser, AwbScanResult, Category, Coupon, Courier,
  Dashboard, Feedback, LowStockRow, Movement, OrderDetail, OrderStatus,
  OrderSummary, Page, Product, Review, SettingsMap, Variant,
} from './types';

/**
 * The single place that talks to the API.
 *
 * Its real job is absorbing the server's inconsistencies so no page ever has
 * to know about them:
 *   - two pagination envelopes: {items,page,limit,totalPages} and
 *     {data,page,per_page,total}
 *   - snake_case columns leaking from MySQL alongside camelCase fields
 *   - ids as strings, booleans as 0/1
 *
 * Every normaliser below exists because the live API actually does that.
 */

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the session is gone and the user must sign in again. */
  get isAuthError() {
    return this.status === 401 || this.code === 'TOKEN_EXPIRED';
  }
}

/* ------------------------------------------------------------ coercion */

const num = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

/** MySQL sends TINYINT(1) as 0/1; JSON sends true/false. Accept both. */
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const nullableStr = (v: unknown): string | null =>
  v == null || v === '' ? null : String(v);
const nullableNum = (v: unknown): number | null =>
  v == null || v === '' ? null : num(v);

/** Reads either camelCase or snake_case, whichever the endpoint happens to use. */
function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k];
  }
  return undefined;
}

/* ------------------------------------------------------------- transport */

interface RequestOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** FormData bypasses JSON encoding (used by the label scanner). */
  form?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body, query, form, signal } = opts;

  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
      cache: 'no-store',
    });
  } catch (err) {
    // A network failure must not surface as "undefined is not an object"
    // three components deep.
    throw new ApiError(
      0,
      'NETWORK',
      'Could not reach the server. Check your connection and try again.',
      err,
    );
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new ApiError(res.status, 'BAD_RESPONSE', `Server error (${res.status}).`);
      }
    }
  }

  if (!res.ok) {
    const e = (parsed as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? `Request failed (${res.status}).`,
      e?.details,
    );
  }

  return parsed as T;
}

/* ------------------------------------------------------------ envelopes */

/**
 * Normalise BOTH pagination shapes into one.
 * orders → {items, page, limit, totalPages}
 * everything else → {data, page, per_page, total}
 */
function toPage<T>(raw: unknown, map: (row: Record<string, unknown>) => T): Page<T> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rows = (Array.isArray(r.items) ? r.items : Array.isArray(r.data) ? r.data : []) as Record<
    string,
    unknown
  >[];

  const limit = num(pick(r, 'limit', 'per_page'), rows.length || 20);
  const total = num(r.total, rows.length);
  // Clamped to 1: /admin/orders returns totalPages: 0 on an empty result, and
  // "Page 1 of 0" is nonsense. Verified against the live server.
  const totalPages = Math.max(
    1,
    r.totalPages !== undefined
      ? num(r.totalPages)
      : limit > 0
        ? Math.ceil(total / limit)
        : 1,
  );

  return { items: rows.map(map), page: num(r.page, 1), limit, total, totalPages };
}

/** For endpoints returning a bare list under `items` or `data`. */
function toList<T>(raw: unknown, map: (row: Record<string, unknown>) => T): T[] {
  const r = raw as Record<string, unknown> | unknown[];
  const rows = Array.isArray(r)
    ? r
    : Array.isArray((r as Record<string, unknown>)?.items)
      ? ((r as Record<string, unknown>).items as unknown[])
      : Array.isArray((r as Record<string, unknown>)?.data)
        ? ((r as Record<string, unknown>).data as unknown[])
        : [];
  return (rows as Record<string, unknown>[]).map(map);
}

/* ------------------------------------------------------------- mappers */

const mapUser = (r: Record<string, unknown>): AdminUser => ({
  id: num(r.id),
  email: str(r.email),
  fullName: str(pick(r, 'fullName', 'full_name')),
  role: (str(r.role) || 'staff') as AdminUser['role'],
  isActive: r.is_active === undefined && r.isActive === undefined ? true : bool(pick(r, 'isActive', 'is_active')),
  lastLoginAt: nullableStr(pick(r, 'lastLoginAt', 'last_login_at')),
  createdAt: nullableStr(pick(r, 'createdAt', 'created_at')),
});

const mapOrderSummary = (r: Record<string, unknown>): OrderSummary => ({
  id: num(r.id),
  orderNumber: str(pick(r, 'orderNumber', 'order_number')),
  status: (str(r.status) || 'pending_payment') as OrderStatus,
  paymentStatus: (str(pick(r, 'paymentStatus', 'payment_status')) || 'pending') as OrderSummary['paymentStatus'],
  totalPaise: num(pick(r, 'totalPaise', 'total_paise')),
  shipFullName: str(pick(r, 'shipFullName', 'ship_full_name')),
  shipCity: str(pick(r, 'shipCity', 'ship_city')),
  shipPincode: str(pick(r, 'shipPincode', 'ship_pincode')),
  shipZone: (str(pick(r, 'shipZone', 'ship_zone')) || 'rest_of_india') as OrderSummary['shipZone'],
  itemCount: num(pick(r, 'itemCount', 'item_count')),
  createdAt: str(pick(r, 'createdAt', 'created_at')),
  placedAt: nullableStr(pick(r, 'placedAt', 'placed_at')),
  shippedAt: nullableStr(pick(r, 'shippedAt', 'shipped_at')),
  deliveredAt: nullableStr(pick(r, 'deliveredAt', 'delivered_at')),
});

const mapItem = (r: Record<string, unknown>) => ({
  id: num(r.id),
  productName: str(pick(r, 'productName', 'product_name')),
  sizeMl: num(pick(r, 'sizeMl', 'size_ml')),
  sku: str(r.sku),
  quantity: num(r.quantity),
  unitPricePaise: num(pick(r, 'unitPricePaise', 'unit_price_paise')),
  lineTotalPaise: num(pick(r, 'lineTotalPaise', 'line_total_paise')),
});

const mapShipment = (r: Record<string, unknown>) => ({
  id: num(r.id),
  courierId: num(pick(r, 'courierId', 'courier_id')),
  courierName: str(pick(r, 'courierName', 'courier_name')),
  trackingNumber: str(pick(r, 'trackingNumber', 'tracking_number')),
  trackingUrl: nullableStr(pick(r, 'trackingUrl', 'tracking_url')),
  supportsDeepLink: bool(pick(r, 'supportsDeepLink', 'supports_deep_link')),
  shippedAt: nullableStr(pick(r, 'shippedAt', 'shipped_at')),
  deliveredAt: nullableStr(pick(r, 'deliveredAt', 'delivered_at')),
});

function mapOrderDetail(raw: unknown): OrderDetail {
  const r = (raw ?? {}) as Record<string, unknown>;
  // The endpoint nests the order under `order` and puts items/shipments beside it.
  const o = ((r.order ?? r) as Record<string, unknown>);
  const items = Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : [];
  const shipments = Array.isArray(r.shipments) ? (r.shipments as Record<string, unknown>[]) : [];

  return {
    ...mapOrderSummary(o),
    shipPhone: str(pick(o, 'shipPhone', 'ship_phone')),
    shipAltPhone: nullableStr(pick(o, 'shipAltPhone', 'ship_alt_phone')),
    shipEmail: str(pick(o, 'shipEmail', 'ship_email')),
    shipLine1: str(pick(o, 'shipLine1', 'ship_line1')),
    shipLine2: nullableStr(pick(o, 'shipLine2', 'ship_line2')),
    shipLandmark: nullableStr(pick(o, 'shipLandmark', 'ship_landmark')),
    shipState: str(pick(o, 'shipState', 'ship_state')),
    subtotalPaise: num(pick(o, 'subtotalPaise', 'subtotal_paise')),
    discountPaise: num(pick(o, 'discountPaise', 'discount_paise')),
    shippingPaise: num(pick(o, 'shippingPaise', 'shipping_paise')),
    couponCode: nullableStr(pick(o, 'couponCode', 'coupon_code')),
    customerNote: nullableStr(pick(o, 'customerNote', 'customer_note')),
    adminNote: nullableStr(pick(o, 'adminNote', 'admin_note')),
    cancelReason: nullableStr(pick(o, 'cancelReason', 'cancel_reason')),
    itemCount: items.length || num(pick(o, 'itemCount', 'item_count')),
    items: items.map(mapItem),
    shipments: shipments.map(mapShipment),
  };
}

const mapVariant = (r: Record<string, unknown>): Variant => ({
  id: num(r.id),
  sizeMl: num(pick(r, 'sizeMl', 'size_ml')) as Variant['sizeMl'],
  sku: str(r.sku),
  pricePaise: num(pick(r, 'pricePaise', 'price_paise')),
  compareAtPaise: nullableNum(pick(r, 'compareAtPaise', 'compare_at_paise')),
  stockQty: num(pick(r, 'stockQty', 'stock_qty')),
  lowStockThreshold: num(pick(r, 'lowStockThreshold', 'low_stock_threshold'), 5),
  isEnabled: bool(pick(r, 'isEnabled', 'is_enabled')),
});

const mapImage = (r: Record<string, unknown>) => ({
  id: num(r.id),
  url: str(r.url),
  altText: nullableStr(pick(r, 'altText', 'alt_text')),
  isPrimary: bool(pick(r, 'isPrimary', 'is_primary')),
  sortOrder: num(pick(r, 'sortOrder', 'sort_order')),
});

const mapProduct = (r: Record<string, unknown>): Product => ({
  id: num(r.id),
  slug: str(r.slug),
  name: str(r.name),
  tagline: nullableStr(r.tagline),
  description: nullableStr(r.description),
  scentFamily: nullableStr(pick(r, 'scentFamily', 'scent_family')),
  status: (str(r.status) || 'draft') as Product['status'],
  isFeatured: bool(pick(r, 'isFeatured', 'is_featured')),
  variants: Array.isArray(r.variants) ? (r.variants as Record<string, unknown>[]).map(mapVariant) : [],
  images: Array.isArray(r.images) ? (r.images as Record<string, unknown>[]).map(mapImage) : [],
  createdAt: nullableStr(pick(r, 'createdAt', 'created_at')),
});

const mapLowStock = (r: Record<string, unknown>): LowStockRow => ({
  variantId: num(pick(r, 'variantId', 'variant_id', 'id')),
  productId: num(pick(r, 'productId', 'product_id')),
  productName: str(pick(r, 'productName', 'product_name', 'name')),
  sizeMl: num(pick(r, 'sizeMl', 'size_ml')),
  stockQty: num(pick(r, 'stockQty', 'stock_qty')),
  threshold: num(pick(r, 'threshold', 'lowStockThreshold', 'low_stock_threshold'), 5),
});

const mapMovement = (r: Record<string, unknown>): Movement => ({
  id: num(r.id),
  variantId: num(pick(r, 'variantId', 'variant_id')),
  productName: nullableStr(pick(r, 'productName', 'product_name')),
  sizeMl: nullableNum(pick(r, 'sizeMl', 'size_ml')),
  delta: num(r.delta),
  reason: str(r.reason),
  note: nullableStr(r.note),
  balanceAfter: num(pick(r, 'balanceAfter', 'balance_after')),
  createdAt: str(pick(r, 'createdAt', 'created_at')),
});

const mapCoupon = (r: Record<string, unknown>): Coupon => ({
  id: num(r.id),
  code: str(r.code),
  description: nullableStr(r.description),
  discountType: (str(pick(r, 'discountType', 'discount_type')) || 'percent') as Coupon['discountType'],
  discountValue: num(pick(r, 'discountValue', 'discount_value')),
  maxDiscountPaise: nullableNum(pick(r, 'maxDiscountPaise', 'max_discount_paise')),
  minOrderPaise: num(pick(r, 'minOrderPaise', 'min_order_paise')),
  usageLimit: nullableNum(pick(r, 'usageLimit', 'usage_limit')),
  usedCount: num(pick(r, 'usedCount', 'used_count')),
  startsAt: nullableStr(pick(r, 'startsAt', 'starts_at')),
  expiresAt: nullableStr(pick(r, 'expiresAt', 'expires_at')),
  isActive: bool(pick(r, 'isActive', 'is_active')),
});

const mapCourier = (r: Record<string, unknown>): Courier => ({
  id: num(r.id),
  name: str(r.name),
  slug: str(r.slug),
  trackingUrlTemplate: nullableStr(pick(r, 'trackingUrlTemplate', 'tracking_url_template')),
  supportsDeepLink: bool(pick(r, 'supportsDeepLink', 'supports_deep_link')),
  awbPattern: nullableStr(pick(r, 'awbPattern', 'awb_pattern')),
  phone: nullableStr(r.phone),
  isActive: bool(pick(r, 'isActive', 'is_active')),
  sortOrder: num(pick(r, 'sortOrder', 'sort_order')),
});

const mapReview = (r: Record<string, unknown>): Review => ({
  id: num(r.id),
  productId: num(pick(r, 'productId', 'product_id')),
  productName: nullableStr(pick(r, 'productName', 'product_name')),
  rating: num(r.rating),
  title: nullableStr(r.title),
  body: nullableStr(r.body),
  authorName: str(pick(r, 'authorName', 'author_name')),
  status: (str(r.status) || 'pending') as Review['status'],
  isVerifiedPurchase: bool(pick(r, 'isVerifiedPurchase', 'is_verified_purchase')),
  createdAt: str(pick(r, 'createdAt', 'created_at')),
});

const mapFeedback = (r: Record<string, unknown>): Feedback => ({
  id: num(r.id),
  name: nullableStr(r.name),
  email: nullableStr(r.email),
  subject: nullableStr(r.subject),
  message: str(r.message),
  status: (str(r.status) || 'new') as Feedback['status'],
  createdAt: str(pick(r, 'createdAt', 'created_at')),
});

const mapCategory = (r: Record<string, unknown>): Category => ({
  id: num(r.id),
  slug: str(r.slug),
  name: str(r.name),
  description: nullableStr(r.description),
  productCount: num(pick(r, 'productCount', 'product_count')),
});

const mapNotification = (r: Record<string, unknown>): AdminNotification => ({
  id: num(r.id),
  type: str(r.type),
  title: str(r.title),
  body: nullableStr(r.body),
  isRead: bool(pick(r, 'isRead', 'is_read')),
  createdAt: str(pick(r, 'createdAt', 'created_at')),
});

function mapDashboard(raw: unknown): Dashboard {
  const r = (raw ?? {}) as Record<string, unknown>;
  const window = (v: unknown): { revenuePaise: number; orderCount: number } => {
    const w = (v ?? {}) as Record<string, unknown>;
    return {
      revenuePaise: num(pick(w, 'revenuePaise', 'revenue_paise')),
      orderCount: num(pick(w, 'orderCount', 'order_count')),
    };
  };
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

  return {
    today: window(r.today),
    last7Days: window(pick(r, 'last7Days', 'last_7_days')),
    last30Days: window(pick(r, 'last30Days', 'last_30_days')),
    allTime: window(pick(r, 'allTime', 'all_time')),
    ordersByStatus: (pick(r, 'ordersByStatus', 'orders_by_status') ?? {}) as Dashboard['ordersByStatus'],
    topProducts: arr(pick(r, 'topProducts', 'top_products')).map((p) => ({
      productId: num(pick(p, 'productId', 'product_id', 'id')),
      name: str(pick(p, 'name', 'productName', 'product_name')),
      qtySold: num(pick(p, 'qtySold', 'qty_sold', 'quantity')),
      revenuePaise: num(pick(p, 'revenuePaise', 'revenue_paise')),
    })),
    lowStock: arr(pick(r, 'lowStock', 'low_stock')).map(mapLowStock),
    recentOrders: arr(pick(r, 'recentOrders', 'recent_orders')).map((o) => ({
      id: num(o.id),
      orderNumber: str(pick(o, 'orderNumber', 'order_number')),
      status: (str(o.status) || 'pending_payment') as OrderStatus,
      paymentStatus: (str(pick(o, 'paymentStatus', 'payment_status')) || 'pending') as OrderSummary['paymentStatus'],
      totalPaise: num(pick(o, 'totalPaise', 'total_paise')),
      customerName: str(pick(o, 'customerName', 'customer_name', 'shipFullName', 'ship_full_name')),
      createdAt: str(pick(o, 'createdAt', 'created_at')),
    })),
    pendingReviewCount: num(pick(r, 'pendingReviewCount', 'pending_review_count', 'pending_count')),
    newFeedbackCount: num(pick(r, 'newFeedbackCount', 'new_feedback_count', 'new_count')),
  };
}

/* ------------------------------------------------------------------ api */

export const api = {
  /* auth */
  async login(email: string, password: string) {
    const r = await request<Record<string, unknown>>('/auth/admin/login', {
      method: 'POST',
      body: { email, password },
    });
    return { token: str(r.token), admin: mapUser((r.admin ?? {}) as Record<string, unknown>) };
  },

  me: (token: string) =>
    request<Record<string, unknown>>('/admin/auth/me', { token }).then(mapUser),

  /* dashboard */
  dashboard: (token: string) =>
    request<unknown>('/admin/dashboard', { token }).then(mapDashboard),

  /* orders */
  orders: (token: string, q: { page?: number; limit?: number; status?: string; q?: string } = {}) =>
    request<unknown>('/admin/orders', { token, query: q }).then((r) => toPage(r, mapOrderSummary)),

  order: (token: string, id: number) =>
    request<unknown>(`/admin/orders/${id}`, { token }).then(mapOrderDetail),

  packOrder: (token: string, id: number) =>
    request<unknown>(`/admin/orders/${id}/pack`, { method: 'POST', token }),

  shipOrder: (
    token: string,
    id: number,
    input: {
      courierId: number;
      trackingNumber: string;
      scannedImageUrl?: string | null;
      notes?: string | null;
      ocr?: { suggested?: string | null; confidence?: number | null; rawText?: string | null } | null;
    },
  ) => request<unknown>(`/admin/orders/${id}/ship`, { method: 'POST', token, body: input }),

  deliverOrder: (token: string, id: number) =>
    request<unknown>(`/admin/orders/${id}/deliver`, { method: 'POST', token }),

  cancelOrder: (token: string, id: number, reason: string) =>
    request<unknown>(`/admin/orders/${id}/cancel`, { method: 'POST', token, body: { reason } }),

  /* label OCR — the result is a SUGGESTION the admin confirms, never auto-saved */
  async scanAwb(token: string, file: File, courierId?: number) {
    const form = new FormData();
    form.append('image', file);
    if (courierId) form.append('courier_id', String(courierId));
    const r = await request<Record<string, unknown>>('/admin/shipments/scan-awb', {
      method: 'POST',
      token,
      form,
    });
    return {
      suggested: nullableStr(r.suggested),
      confidence: nullableNum(r.confidence),
      alternatives: Array.isArray(r.alternatives) ? (r.alternatives as unknown[]).map(str) : [],
      rawText: nullableStr(pick(r, 'rawText', 'raw_text')),
      imageUrl: nullableStr(pick(r, 'imageUrl', 'image_url')),
      message: nullableStr(r.message) ?? undefined,
    } as AwbScanResult;
  },

  /* products */
  products: (token: string, q: { page?: number; limit?: number; status?: string; q?: string } = {}) =>
    request<unknown>('/admin/products', { token, query: q }).then((r) => toPage(r, mapProduct)),

  product: (token: string, id: number) =>
    request<unknown>(`/admin/products/${id}`, { token }).then((r) =>
      mapProduct(((r as Record<string, unknown>)?.product ?? r) as Record<string, unknown>),
    ),

  createProduct: (token: string, input: Record<string, unknown>) =>
    request<unknown>('/admin/products', { method: 'POST', token, body: input }).then((r) =>
      mapProduct(((r as Record<string, unknown>)?.product ?? r) as Record<string, unknown>),
    ),

  updateProduct: (token: string, id: number, input: Record<string, unknown>) =>
    request<unknown>(`/admin/products/${id}`, { method: 'PATCH', token, body: input }).then((r) =>
      mapProduct(((r as Record<string, unknown>)?.product ?? r) as Record<string, unknown>),
    ),

  deleteProduct: (token: string, id: number) =>
    request<void>(`/admin/products/${id}`, { method: 'DELETE', token }),

  updateVariant: (token: string, variantId: number, input: Record<string, unknown>) =>
    request<unknown>(`/admin/variants/${variantId}`, { method: 'PATCH', token, body: input }),

  uploadProductImage: async (token: string, productId: number, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return request<unknown>(`/admin/products/${productId}/images`, { method: 'POST', token, form });
  },

  deleteImage: (token: string, imageId: number) =>
    request<void>(`/admin/images/${imageId}`, { method: 'DELETE', token }),

  /* inventory */
  adjustStock: (token: string, variantId: number, input: { delta?: number; stockQty?: number; note?: string }) =>
    request<unknown>(`/admin/variants/${variantId}/stock`, { method: 'PATCH', token, body: input }),

  lowStock: (token: string) =>
    request<unknown>('/admin/inventory/low-stock', { token }).then((r) => toList(r, mapLowStock)),

  movements: (token: string, q: { variant_id?: number; page?: number; limit?: number } = {}) =>
    request<unknown>('/admin/inventory/movements', { token, query: q }).then((r) =>
      toPage(r, mapMovement),
    ),

  /* coupons */
  coupons: (token: string, q: { page?: number; limit?: number } = {}) =>
    request<unknown>('/admin/coupons', { token, query: q }).then((r) => toPage(r, mapCoupon)),

  createCoupon: (token: string, input: Record<string, unknown>) =>
    request<unknown>('/admin/coupons', { method: 'POST', token, body: input }),

  updateCoupon: (token: string, id: number, input: Record<string, unknown>) =>
    request<unknown>(`/admin/coupons/${id}`, { method: 'PATCH', token, body: input }),

  deleteCoupon: (token: string, id: number) =>
    request<void>(`/admin/coupons/${id}`, { method: 'DELETE', token }),

  /* couriers */
  couriers: (token: string) =>
    request<unknown>('/admin/couriers', { token }).then((r) => toList(r, mapCourier)),

  createCourier: (token: string, input: Record<string, unknown>) =>
    request<unknown>('/admin/couriers', { method: 'POST', token, body: input }),

  updateCourier: (token: string, id: number, input: Record<string, unknown>) =>
    request<unknown>(`/admin/couriers/${id}`, { method: 'PATCH', token, body: input }),

  deleteCourier: (token: string, id: number) =>
    request<void>(`/admin/couriers/${id}`, { method: 'DELETE', token }),

  /* reviews & feedback */
  reviews: (token: string, q: { status?: string; page?: number; limit?: number } = {}) =>
    request<unknown>('/admin/reviews', { token, query: q }).then((r) => toPage(r, mapReview)),

  setReviewStatus: (token: string, id: number, status: string) =>
    request<unknown>(`/admin/reviews/${id}/status`, { method: 'PATCH', token, body: { status } }),

  feedback: (token: string, q: { status?: string; page?: number; limit?: number } = {}) =>
    request<unknown>('/admin/feedback', { token, query: q }).then((r) => toPage(r, mapFeedback)),

  setFeedbackStatus: (token: string, id: number, status: string) =>
    request<unknown>(`/admin/feedback/${id}/status`, { method: 'PATCH', token, body: { status } }),

  /* categories, settings, users, notifications */
  categories: (token: string) =>
    request<unknown>('/admin/categories', { token }).then((r) => toList(r, mapCategory)),

  settings: async (token: string): Promise<SettingsMap> => {
    const r = await request<Record<string, unknown>>('/admin/settings', { token });
    return (r?.settings ?? r ?? {}) as SettingsMap;
  },

  updateSetting: (token: string, key: string, value: unknown) =>
    request<unknown>(`/admin/settings/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      token,
      body: { value },
    }),

  users: (token: string) =>
    request<unknown>('/admin/users', { token }).then((r) => toList(r, mapUser)),

  createUser: (token: string, input: Record<string, unknown>) =>
    request<unknown>('/admin/users', { method: 'POST', token, body: input }),

  updateUser: (token: string, id: number, input: Record<string, unknown>) =>
    request<unknown>(`/admin/users/${id}`, { method: 'PATCH', token, body: input }),

  deleteUser: (token: string, id: number) =>
    request<void>(`/admin/users/${id}`, { method: 'DELETE', token }),

  notifications: (token: string, q: { page?: number; limit?: number } = {}) =>
    request<unknown>('/admin/notifications', { token, query: q }).then((r) =>
      toPage(r, mapNotification),
    ),

  readNotification: (token: string, id: number) =>
    request<unknown>(`/admin/notifications/${id}/read`, { method: 'POST', token }),

  readAllNotifications: (token: string) =>
    request<unknown>('/admin/notifications/read-all', { method: 'POST', token }),
};
