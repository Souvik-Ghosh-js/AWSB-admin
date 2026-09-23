/**
 * Types for the admin API.
 *
 * Every shape here was read from the LIVE server on 2026-09-16, not inferred
 * from the backend source. That distinction matters: the previous client
 * declared `Promise<Category[]>` for an endpoint that actually returns
 * `{items: [...]}`, TypeScript believed it, and the first real build crashed.
 *
 * Two quirks the API genuinely has, which the client normalises:
 *   1. TWO pagination envelopes — `{items, page, limit, totalPages}` on orders,
 *      `{data, page, per_page, total}` on products/coupons/reviews/feedback.
 *   2. MySQL leaks through — `id` arrives as a string, booleans as 0/1, and
 *      several tables expose snake_case column names.
 */

/* ------------------------------------------------------------------ auth */

export type AdminRole = 'owner' | 'manager' | 'staff';

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface LoginResult {
  token: string;
  admin: AdminUser;
}

/* ------------------------------------------------------------- dashboard */

export interface RevenueWindow {
  revenuePaise: number;
  orderCount: number;
}

export interface DashboardTopProduct {
  productId: number;
  name: string;
  slug: string | null;
  qtySold: number;
  revenuePaise: number;
}

export interface DashboardLowStock {
  variantId: number;
  productId: number;
  productName: string;
  sizeMl: number;
  stockQty: number;
  threshold: number;
}

export interface DashboardOrder {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaise: number;
  customerName: string;
  createdAt: string;
}

export interface Dashboard {
  today: RevenueWindow;
  last7Days: RevenueWindow;
  last30Days: RevenueWindow;
  allTime: RevenueWindow;
  /** Keyed by status; absent keys mean zero. */
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  topProducts: DashboardTopProduct[];
  lowStock: DashboardLowStock[];
  recentOrders: DashboardOrder[];
  pendingReviewCount: number;
  newFeedbackCount: number;
}

/* ---------------------------------------------------------------- orders */

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface OrderSummary {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaise: number;
  shipFullName: string;
  shipCity: string;
  shipPincode: string;
  shipZone: 'kolkata' | 'rest_of_india';
  itemCount: number;
  createdAt: string;
  placedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderItem {
  id: number;
  productName: string;
  sizeMl: number;
  sku: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface Shipment {
  id: number;
  courierId: number;
  courierName: string;
  trackingNumber: string;
  trackingUrl: string | null;
  supportsDeepLink: boolean;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderDetail extends OrderSummary {
  shipPhone: string;
  shipAltPhone: string | null;
  shipEmail: string;
  shipLine1: string;
  shipLine2: string | null;
  shipLandmark: string | null;
  shipState: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  couponCode: string | null;
  customerNote: string | null;
  adminNote: string | null;
  cancelReason: string | null;
  items: OrderItem[];
  shipments: Shipment[];
}

/* -------------------------------------------------------------- products */

export interface Variant {
  id: number;
  sizeMl: 3 | 6 | 12;
  sku: string;
  pricePaise: number;
  compareAtPaise: number | null;
  stockQty: number;
  lowStockThreshold: number;
  isEnabled: boolean;
}

export interface ProductImage {
  id: number;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  scentFamily: string | null;
  status: 'draft' | 'active' | 'archived';
  isFeatured: boolean;
  variants: Variant[];
  images: ProductImage[];
  /** Which categories (Attars, Powders, Bakhoor, Incense, ...) this product belongs to. */
  categories: { id: number; slug: string; name: string }[];
  createdAt: string | null;
}

/* ------------------------------------------------------------- inventory */

export interface LowStockRow {
  variantId: number;
  productId: number;
  productName: string;
  sizeMl: number;
  stockQty: number;
  threshold: number;
}

export interface Movement {
  id: number;
  variantId: number;
  productName: string | null;
  sizeMl: number | null;
  delta: number;
  reason: string;
  note: string | null;
  balanceAfter: number;
  createdAt: string;
}

/* --------------------------------------------------------------- coupons */

export interface Coupon {
  id: number;
  code: string;
  description: string | null;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

/* -------------------------------------------------------------- couriers */

export interface Courier {
  id: number;
  name: string;
  slug: string;
  trackingUrlTemplate: string | null;
  /** False for India Post, DTDC, TPC, Trackon — they cannot be deep-linked. */
  supportsDeepLink: boolean;
  awbPattern: string | null;
  phone: string | null;
  isActive: boolean;
  sortOrder: number;
}

/* ------------------------------------------------------ reviews & feedback */

export interface Review {
  id: number;
  productId: number;
  productName: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  status: 'pending' | 'approved' | 'rejected';
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface Feedback {
  id: number;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string;
  status: 'new' | 'read' | 'responded' | 'closed';
  createdAt: string;
}

/* ------------------------------------------------ categories & settings */

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
}

export type SettingsMap = Record<string, unknown>;

export interface AdminNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: number | null;
  isRead: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------ AWB / OCR */

export interface AwbScanResult {
  /** OCR's best guess. ALWAYS confirmed by a human before it is saved. */
  suggested: string | null;
  confidence: number | null;
  alternatives: string[];
  rawText: string | null;
  imageUrl: string | null;
  message?: string;
}

/* ------------------------------------------------------------ pagination */

/** Both API envelope styles normalise to this. */
export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
