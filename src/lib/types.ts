/**
 * The API contract, as TypeScript.
 *
 * These types mirror the shapes the Express API returns (`/api/v1/*`). Where
 * the API already has a canonical shaping function, these types follow it
 * exactly rather than guessing:
 *
 *   - api/src/modules/catalog/catalog.pure.js `shapeVariant()` — public
 *     variant output is camelCase and exposes `inStock` as a BOOLEAN, never a
 *     raw stock count. Raw `stockQty` appears only on admin types.
 *   - api/src/modules/catalog/catalog.pure.js `buildPage()` — every list
 *     endpoint returns the same paginated envelope.
 *   - api/src/db/migrations/001_init.sql — enum members and field names.
 *
 * Money is ALWAYS an integer number of paise.
 */

/* ------------------------------------------------------------ envelopes */

/** The envelope every list endpoint returns — see buildPage(). */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Error body the API returns on a non-2xx. */
export interface ApiErrorBody {
  message?: string;
  code?: string;
  errors?: Record<string, string | string[]>;
}

/* ------------------------------------------------------------ catalogue */

export type ProductStatus = 'draft' | 'active' | 'archived';

/** Public variant shape — mirrors shapeVariant(). */
export interface Variant {
  id: number;
  sizeMl: number;
  sku: string;
  pricePaise: number;
  compareAtPaise: number | null;
  /**
   * Derived server-side. The public API deliberately does NOT expose the raw
   * stock count — knowing a competitor holds 3 units invites scraping.
   */
  inStock: boolean;
  isLowStock: boolean;
}

export interface ProductImage {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

/** products.scent_notes is JSON: {top:[],heart:[],base:[]}. */
export interface ScentNotes {
  top?: string[];
  heart?: string[];
  base?: string[];
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  /** Present on /categories when the API counts products per category. */
  productCount?: number;
}

/** A product as it appears in a listing (grid card). */
export interface ProductSummary {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  scentFamily: string | null;
  isFeatured: boolean;
  /** Cheapest enabled variant — what the card shows as "from ₹…". */
  minPricePaise: number;
  maxPricePaise?: number;
  primaryImage: ProductImage | null;
  ratingAvg: number | null;
  ratingCount: number;
  /** False when every variant is out of stock. */
  inStock?: boolean;
}

/** Full product detail — /products/:slug. */
export interface ProductDetail extends ProductSummary {
  description: string | null;
  scentNotes: ScentNotes | null;
  metaTitle: string | null;
  metaDescription: string | null;
  images: ProductImage[];
  /** 3ml / 6ml / 12ml, each with its own price and stock. */
  variants: Variant[];
  categories: Category[];
  reviews: Review[];
}

/* -------------------------------------------------------------- reviews */

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  /** Admin moderation views include the status; public views do not. */
  status?: ReviewStatus;
  productId?: number;
  productName?: string;
  productSlug?: string;
}

export interface ReviewInput {
  productId: number;
  orderNumber: string;
  email: string;
  rating: number;
  title?: string;
  body?: string;
  authorName: string;
}

/* ----------------------------------------------------------------- cart */

/**
 * What the client sends when it needs the server to re-price a cart.
 * Only the variant id and quantity are trusted — never the price held in
 * localStorage, which the shopper can edit.
 */
export interface CartLineInput {
  variantId: number;
  quantity: number;
}

/** A re-priced line returned by /cart/validate. */
export interface ValidatedCartLine {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  sizeMl: number;
  sku: string;
  unitPricePaise: number;
  quantity: number;
  /** Clamped to available stock if the requested quantity exceeded it. */
  availableQuantity: number;
  lineTotalPaise: number;
  imageUrl: string | null;
  inStock: boolean;
}

export interface CartValidation {
  items: ValidatedCartLine[];
  subtotalPaise: number;
  /** Populated when a line was re-priced, clamped, or removed. */
  adjustments: CartAdjustment[];
}

export interface CartAdjustment {
  variantId: number;
  type: 'price_changed' | 'quantity_clamped' | 'removed' | 'out_of_stock';
  message: string;
}

/* ------------------------------------------------------------- shipping */

export type ShipZone = 'kolkata' | 'rest_of_india';

/**
 * Live shipping quote for a pincode — ₹49 (4900) for Kolkata 700001-700199,
 * ₹99 (9900) elsewhere. Mirrors calculateShipping() in the API.
 */
export interface ShippingQuote {
  zoneId: number;
  zoneSlug: ShipZone;
  zoneName: string;
  shippingPaise: number;
  isFree: boolean;
}

/** Pincode lookup, which autofills city/district/state at checkout. */
export interface PincodeLookup {
  pincode: string;
  city: string | null;
  district: string | null;
  state: string | null;
  zone: ShippingQuote;
}

/* -------------------------------------------------------------- coupons */

export type DiscountType = 'percent' | 'fixed';

export interface CouponPreview {
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  discountPaise: number;
  valid: boolean;
  message?: string;
}

export interface Coupon {
  id: number;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

/* --------------------------------------------------------------- orders */

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

/**
 * The shipping address, exactly as orders.ship_* snapshots it.
 * Required: fullName, phone, email, line1, city, state, pincode.
 * Optional: line2, landmark, altPhone, district.
 */
export interface ShippingAddress {
  fullName: string;
  phone: string;
  altPhone?: string | null;
  email: string;
  /** House/flat number + building. Required — a vague address costs a re-attempt fee. */
  line1: string;
  /** Area, street, sector. */
  line2?: string | null;
  /** "near …" — a real delivery aid in India. */
  landmark?: string | null;
  city: string;
  district?: string | null;
  state: string;
  /** Exactly 6 digits. */
  pincode: string;
  country?: string;
}

export interface OrderItem {
  id?: number;
  variantId: number | null;
  productName: string;
  productSlug?: string | null;
  sizeMl: number;
  sku: string;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
  imageUrl?: string | null;
}

export interface ShipmentSummary {
  id: number;
  courierName: string;
  courierSlug: string;
  trackingNumber: string;
  /** Null when the courier CAPTCHA-gates its tracking page. */
  trackingUrl: string | null;
  supportsDeepLink: boolean;
  shippedAt: string | null;
  deliveredAt: string | null;
}

/** An order as the customer sees it (confirmation page, guest tracking). */
export interface Order {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  currency: string;
  couponCode: string | null;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  shipZone: ShipZone;
  customerNote: string | null;
  shipment: ShipmentSummary | null;
  placedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------- checkout */

export interface CheckoutSessionInput {
  items: CartLineInput[];
  shippingAddress: ShippingAddress;
  couponCode?: string | null;
  customerNote?: string | null;
  marketingOptIn?: boolean;
}

/**
 * What /checkout/session returns. Note what is NOT here: no key secret. The
 * browser opens Razorpay with the PUBLISHABLE key id from the environment and
 * the order id minted server-side.
 */
export interface CheckoutSession {
  orderNumber: string;
  razorpayOrderId: string;
  /** Total in paise — what Razorpay Checkout is opened with. */
  amountPaise: number;
  currency: string;
  /** Echoed back so the client can show the final figure it is charging. */
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  /** Optional: the API may echo its own key id so the client need not guess. */
  razorpayKeyId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/** The three fields Razorpay Checkout hands back to the browser handler. */
export interface RazorpayVerifyInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Provisional confirmation. The AUTHORITATIVE fulfilment trigger is the
 * `order.paid` webhook server-side; this response only lets the browser show
 * a fast thank-you screen.
 */
export interface CheckoutVerifyResult {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  verified: boolean;
}

/* -------------------------------------------------------------- contact */

export interface FeedbackInput {
  name?: string;
  email?: string;
  subject?: string;
  message: string;
  orderNumber?: string;
}

export type FeedbackStatus = 'new' | 'read' | 'responded' | 'closed';

export interface Feedback {
  id: number;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string;
  orderNumber?: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

/* --------------------------------------------------------------- admin */

export type AdminRole = 'owner' | 'manager' | 'staff';

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminLoginResult {
  token: string;
  /** Seconds until the JWT expires (ADMIN_JWT_EXPIRES_IN, default 12h). */
  expiresIn?: number;
  user: AdminUser;
}

export interface DashboardTile {
  revenuePaise: number;
  orderCount: number;
}

export interface TopProduct {
  productId: number;
  name: string;
  slug: string;
  unitsSold: number;
  revenuePaise: number;
}

export interface LowStockRow {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  sizeMl: number;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
}

export interface AdminDashboard {
  today: DashboardTile;
  last7Days: DashboardTile;
  last30Days: DashboardTile;
  allTime: DashboardTile;
  ordersByStatus: Record<OrderStatus, number>;
  topProducts: TopProduct[];
  lowStock: LowStockRow[];
  recentOrders: AdminOrderSummary[];
  pendingReviewCount: number;
  newFeedbackCount: number;
}

export interface AdminOrderSummary {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaise: number;
  itemCount: number;
  shipFullName: string;
  shipCity: string;
  shipPincode: string;
  shipZone: ShipZone;
  placedAt: string | null;
  createdAt: string;
}

export interface AdminOrderDetail extends Order {
  id: number;
  customerId: number | null;
  adminNote: string | null;
  shipEmail: string;
  shipPhone: string;
  payment: {
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    method: string | null;
    status: string | null;
    amountPaise: number | null;
    errorDescription: string | null;
  } | null;
}

/** Admin variant view — unlike the public shape, this DOES carry raw stock. */
export interface AdminVariant {
  id: number;
  productId: number;
  sizeMl: number;
  sku: string;
  pricePaise: number;
  compareAtPaise: number | null;
  stockQty: number;
  lowStockThreshold: number;
  isEnabled: boolean;
  weightGrams: number | null;
}

export interface AdminProduct {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  scentFamily: string | null;
  scentNotes: ScentNotes | null;
  status: ProductStatus;
  isFeatured: boolean;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
  images: ProductImage[];
  variants: AdminVariant[];
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  scentFamily?: string | null;
  scentNotes?: ScentNotes | null;
  status: ProductStatus;
  isFeatured: boolean;
  sortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
  categoryIds?: number[];
  variants: VariantInput[];
}

export interface VariantInput {
  id?: number;
  sizeMl: number;
  sku: string;
  pricePaise: number;
  compareAtPaise?: number | null;
  stockQty: number;
  lowStockThreshold: number;
  isEnabled: boolean;
  weightGrams?: number | null;
}

export type MovementReason =
  | 'sale'
  | 'restock'
  | 'cancellation'
  | 'refund'
  | 'manual_adjustment'
  | 'damage'
  | 'reservation_release';

export interface InventoryMovement {
  id: number;
  variantId: number;
  productName: string;
  sizeMl: number;
  sku: string;
  delta: number;
  reason: MovementReason;
  orderNumber: string | null;
  note: string | null;
  actorEmail: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface Courier {
  id: number;
  name: string;
  slug: string;
  trackingUrlTemplate: string | null;
  /** FALSE = CAPTCHA-gated; the email shows a copyable number, not a link. */
  supportsDeepLink: boolean;
  /** Regex. The admin UI WARNS on mismatch — it must never block. */
  awbPattern: string | null;
  phone: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CourierInput {
  name: string;
  slug: string;
  trackingUrlTemplate?: string | null;
  supportsDeepLink: boolean;
  awbPattern?: string | null;
  phone?: string | null;
  isActive: boolean;
  sortOrder?: number;
}

/**
 * Result of OCR'ing a courier label photo.
 * This is ALWAYS a suggestion that pre-fills an editable field — never
 * auto-submitted. OCR confuses 0/O, 1/I/7, 5/S and 8/B on thermal labels, and
 * a wrong AWB emails the customer someone else's tracking link.
 */
export interface AwbScanResult {
  /** Largest-font candidate. Null when nothing plausible was found. */
  suggested: string | null;
  /** 0..1 from the OCR engine. */
  confidence: number | null;
  /** Runner-up candidates, offered as one-tap alternatives. */
  alternatives: string[];
  /** Full OCR dump, kept for debugging misreads. */
  rawText?: string | null;
  /** URL of the stored label photo, shown beside the field for confirmation. */
  imageUrl: string | null;
  /** Format warning. Advisory only — never a rejection. */
  warning?: string | null;
}

export interface ShipOrderInput {
  courierId: number;
  trackingNumber: string;
  /** Set when the number came from a scan, so was_ocr_edited can be derived. */
  entryMethod?: 'manual' | 'scan';
  scannedImageUrl?: string | null;
  ocrSuggested?: string | null;
  ocrConfidence?: number | null;
  ocrRawText?: string | null;
  notes?: string | null;
}

export interface SettingEntry {
  keyName: string;
  value: unknown;
  updatedAt?: string;
}

export interface AdminUserInput {
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  /** Only sent on create, or on an explicit password reset. */
  password?: string;
}
