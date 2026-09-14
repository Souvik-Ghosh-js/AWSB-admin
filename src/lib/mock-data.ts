/**
 * Mock catalogue for local visual development.
 *
 * The API is not running and MySQL is not installed, so this module lets every
 * page be designed and reviewed with realistic content. It is used ONLY when
 * NEXT_PUBLIC_USE_MOCKS=true, and never in production — see getProductsSafe()
 * and friends in lib/data.ts, which are the only callers.
 *
 * The shapes here are the contract types verbatim. If a page renders correctly
 * against these, it renders correctly against the real API.
 *
 * Product photography: no binary assets are committed, so images are inline
 * SVG data URIs rendering a bottle on an ivory ground. They are placeholders
 * for real photography, not a design decision.
 */

import type {
  AdminDashboard,
  AdminOrderDetail,
  AdminOrderSummary,
  Category,
  Courier,
  Order,
  ProductDetail,
  ProductImage,
  ProductSummary,
  Review,
} from './types';

/* ------------------------------------------------------- placeholder art */

/**
 * A bottle silhouette on an ivory plate, as a data URI. Encoded with
 * encodeURIComponent rather than base64 so the markup stays readable and
 * diffable.
 */
function bottleImage(
  glass: string,
  liquid: string,
  cap: string,
  seed: number
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs>
    <radialGradient id="plate" cx="50%" cy="34%" r="76%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="72%" stop-color="#f3eee3"/>
      <stop offset="100%" stop-color="#e7dfcd"/>
    </radialGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${glass}" stop-opacity="0.95"/>
      <stop offset="34%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="62%" stop-color="${glass}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="${glass}" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="liquid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${liquid}" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="${liquid}" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="cap" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${cap}"/>
      <stop offset="42%" stop-color="#eddfba"/>
      <stop offset="100%" stop-color="${cap}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#plate)"/>
  <ellipse cx="400" cy="812" rx="168" ry="26" fill="#1f2a24" opacity="0.10"/>
  <rect x="352" y="196" width="96" height="70" rx="6" fill="url(#cap)"/>
  <rect x="368" y="176" width="64" height="30" rx="5" fill="${cap}"/>
  <rect x="374" y="262" width="52" height="40" fill="${glass}" opacity="0.5"/>
  <path d="M300 302 h200 a34 34 0 0 1 34 34 v406 a56 56 0 0 1 -56 56 h-156 a56 56 0 0 1 -56 -56 v-406 a34 34 0 0 1 34 -34 z" fill="url(#glass)"/>
  <path d="M312 470 h176 v268 a44 44 0 0 1 -44 44 h-88 a44 44 0 0 1 -44 -44 z" fill="url(#liquid)"/>
  <rect x="330" y="${520 + (seed % 3) * 14}" width="140" height="106" rx="3" fill="#faf7f0" opacity="0.9"/>
  <rect x="348" y="${544 + (seed % 3) * 14}" width="104" height="2" fill="#b08d3f"/>
  <rect x="348" y="${566 + (seed % 3) * 14}" width="72" height="2" fill="#7a8079" opacity="0.6"/>
  <rect x="348" y="${580 + (seed % 3) * 14}" width="90" height="2" fill="#7a8079" opacity="0.45"/>
  <path d="M330 330 q22 -14 44 0 v330 q-22 14 -44 0 z" fill="#ffffff" opacity="0.28"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ART = {
  oud: bottleImage('#3d2a18', '#5a3210', '#b08d3f', 1),
  rose: bottleImage('#5a2233', '#9c3b52', '#b08d3f', 2),
  musk: bottleImage('#4a4335', '#cbb88a', '#b08d3f', 3),
  amber: bottleImage('#5a3a12', '#c07f22', '#b08d3f', 4),
  jasmine: bottleImage('#3f4a35', '#d8cf9a', '#b08d3f', 5),
  sandal: bottleImage('#53402a', '#a9763f', '#b08d3f', 6),
};

/* --------------------------------------------------------------- helpers */

let idSeq = 1000;
function nextId(): number {
  return ++idSeq;
}

/**
 * Build the image set for a product, plus the `primaryImage` that
 * ProductSummary (and therefore ProductDetail) requires. Returning both from
 * one helper keeps them from drifting apart.
 */
function images(art: string, alt: string): {
  images: ProductImage[];
  primaryImage: ProductImage;
} {
  const set: ProductImage[] = [
    {
      id: nextId(),
      url: art,
      altText: alt,
      sortOrder: 0,
      isPrimary: true,
    },
    {
      id: nextId(),
      url: art,
      altText: `${alt} — bottle detail`,
      sortOrder: 1,
      isPrimary: false,
    },
    {
      id: nextId(),
      url: art,
      altText: `${alt} — applied to the wrist`,
      sortOrder: 2,
      isPrimary: false,
    },
  ];

  // The non-null assertion is safe: the literal above always has a [0].
  return { images: set, primaryImage: set[0]! };
}

/**
 * Build the three size variants. Per the schema each has an INDEPENDENT price
 * and stock — 12ml is not simply 4x the 3ml price, and one size selling out
 * does not affect the others.
 */
function variants(
  base: number,
  stock: [number, number, number],
  compareAt?: [number | null, number | null, number | null]
) {
  const prices: [number, number, number] = [base, Math.round(base * 1.85), Math.round(base * 3.4)];
  const sizes: [number, number, number] = [3, 6, 12];

  return sizes.map((sizeMl, i) => ({
    id: nextId(),
    sizeMl,
    sku: `AWSB-${sizeMl.toString().padStart(2, '0')}-${nextId()}`,
    pricePaise: prices[i] ?? base,
    compareAtPaise: compareAt?.[i] ?? null,
    inStock: (stock[i] ?? 0) > 0,
    isLowStock: (stock[i] ?? 0) > 0 && (stock[i] ?? 0) <= 5,
  }));
}

/* ------------------------------------------------------------ categories */

export const mockCategories: Category[] = [
  { id: 1, slug: 'oud', name: 'Oud', sortOrder: 10, productCount: 2, description: 'Deep, resinous agarwood — the heart of the attar tradition.' },
  { id: 2, slug: 'floral', name: 'Floral', sortOrder: 20, productCount: 2, description: 'Rose, jasmine and the flowers of a Bengal summer.' },
  { id: 3, slug: 'musk', name: 'Musk', sortOrder: 30, productCount: 1, description: 'Soft, skin-close warmth that lingers for hours.' },
  { id: 4, slug: 'amber', name: 'Amber', sortOrder: 40, productCount: 1, description: 'Golden, balsamic and quietly sweet.' },
  { id: 5, slug: 'gift-sets', name: 'Gift Sets', sortOrder: 50, productCount: 0, description: 'Curated trios, boxed by hand.' },
];

/* -------------------------------------------------------------- reviews */

function reviews(names: string[], product: string): Review[] {
  const bodies = [
    `Wore this to a wedding in Salt Lake and three people asked what I had on. The ${product} settles beautifully after twenty minutes.`,
    'Genuine attar, no alcohol, and the 6ml bottle is lasting me months. Packed carefully and reached Behala in two days.',
    'Bought the 3ml first to test and immediately ordered the 12ml. The sillage is soft but it stays on the wrist all day.',
    'Reminds me of the attar my grandfather wore. Rare to find this quality at this price now.',
  ];

  return names.map((authorName, i) => ({
    id: nextId(),
    rating: i === 3 ? 4 : 5,
    title: ['Exceptional depth', 'Lasts all day', 'Worth every rupee', 'Beautiful, subtle'][i] ?? 'Lovely',
    body: bodies[i] ?? bodies[0] ?? null,
    authorName,
    isVerifiedPurchase: true,
    createdAt: new Date(Date.now() - (i + 1) * 9 * 86_400_000).toISOString(),
  }));
}

/* ------------------------------------------------------------- products */

export const mockProducts: ProductDetail[] = [
  {
    id: 101,
    slug: 'waalid-shamama',
    name: 'Waalid Shamama',
    tagline: 'Smoked agarwood, saffron and a long amber close',
    scentFamily: 'Oud',
    isFeatured: true,
    minPricePaise: 45000,
    maxPricePaise: 153000,
    description: `Shamama is the old Kannauj art of distilling dozens of herbs and spices into a single, unhurried accord — and *Waalid* is our tribute to it.

The opening is smoke and saffron, almost medicinal for a moment. Then the agarwood arrives: resinous, a little animalic, unmistakably real. Two hours in it has softened into amber and dry sandalwood that stays close to the skin until you wash it off.

Aged for eleven months in glass before bottling. Alcohol-free, so it warms with your body rather than flashing off.`,
    scentNotes: {
      top: ['Saffron', 'Clove', 'Cardamom'],
      heart: ['Agarwood', 'Rose absolute', 'Nagarmotha'],
      base: ['Amber', 'Sandalwood', 'Musk'],
    },
    metaTitle: null,
    metaDescription: null,
    ...images(ART.oud, 'Waalid Shamama attar in a faceted glass bottle'),
    variants: variants(45000, [24, 11, 4]),
    categories: [mockCategories[0]!],
    reviews: reviews(['Imran S.', 'Debjani R.', 'A. Haque', 'Sourav M.'], 'oud'),
    ratingAvg: 4.8,
    ratingCount: 4,
    inStock: true,
  },
  {
    id: 102,
    slug: 'gulab-e-bangla',
    name: 'Gulab-e-Bangla',
    tagline: 'Fresh Kannauj rose over green sandalwood',
    scentFamily: 'Floral',
    isFeatured: true,
    minPricePaise: 39000,
    maxPricePaise: 132600,
    description: `A rose attar that smells like the flower and not like rose soap.

We use rose distilled on sandalwood — the traditional *ruh gulab* method — so the petals sit on a green, milky base rather than a synthetic sweetness. It is bright for the first hour and then turns powdery and calm.

Equally worn by men and women in Bengal, and our most-repeated order.`,
    scentNotes: {
      top: ['Damask rose', 'Geranium'],
      heart: ['Rose absolute', 'Violet leaf'],
      base: ['Mysore sandalwood', 'White musk'],
    },
    metaTitle: null,
    metaDescription: null,
    ...images(ART.rose, 'Gulab-e-Bangla rose attar bottle'),
    variants: variants(39000, [40, 18, 9], [null, 82000, null]),
    categories: [mockCategories[1]!],
    reviews: reviews(['Priyanka D.', 'Rehan A.', 'M. Chatterjee', 'Anjali B.'], 'rose'),
    ratingAvg: 4.9,
    ratingCount: 4,
    inStock: true,
  },
  {
    id: 103,
    slug: 'mushk-al-layl',
    name: 'Mushk al-Layl',
    tagline: 'White musk, warm and close to the skin',
    scentFamily: 'Musk',
    isFeatured: true,
    minPricePaise: 32000,
    maxPricePaise: 108800,
    description: `Night musk. Soft, clean and almost edible — the sort of scent people notice only when they are standing close to you.

There is no oud and no spice here, which makes it the easiest bottle in the house to wear to an office or a long journey. It is also the one most people buy a second time in 12ml.`,
    scentNotes: {
      top: ['Bergamot', 'Pear'],
      heart: ['White musk', 'Iris'],
      base: ['Vanilla', 'Tonka bean', 'Cedar'],
    },
    metaTitle: null,
    metaDescription: null,
    ...images(ART.musk, 'Mushk al-Layl white musk attar bottle'),
    variants: variants(32000, [60, 31, 14]),
    categories: [mockCategories[2]!],
    reviews: reviews(['Farhan K.', 'Rupa S.', 'Tanmoy G.', 'Nusrat J.'], 'musk'),
    ratingAvg: 4.7,
    ratingCount: 4,
    inStock: true,
  },
  {
    id: 104,
    slug: 'ambar-sonali',
    name: 'Ambar Sonali',
    tagline: 'Golden amber, labdanum and vanilla',
    scentFamily: 'Amber',
    isFeatured: true,
    minPricePaise: 42000,
    maxPricePaise: 142800,
    description: `Amber in the old sense — a blend, not a resin. Labdanum and benzoin over vanilla, thickened with a little beeswax absolute.

Warm enough for a Kolkata December and heavy enough that one dab on the wrist is genuinely all you need. This is the bottle we most often recommend as a first attar.`,
    scentNotes: {
      top: ['Orange peel', 'Pink pepper'],
      heart: ['Labdanum', 'Benzoin', 'Beeswax'],
      base: ['Vanilla', 'Amber', 'Patchouli'],
    },
    metaTitle: null,
    metaDescription: null,
    ...images(ART.amber, 'Ambar Sonali amber attar bottle'),
    variants: variants(42000, [18, 7, 0]),
    categories: [mockCategories[3]!],
    reviews: reviews(['Sanjay P.', 'Ishita M.', 'Kabir R.', 'Lopa D.'], 'amber'),
    ratingAvg: 4.6,
    ratingCount: 4,
    inStock: true,
  },
  {
    id: 105,
    slug: 'raat-ki-rani',
    name: 'Raat Ki Rani',
    tagline: 'Night jasmine, green and narcotic',
    scentFamily: 'Floral',
    isFeatured: false,
    minPricePaise: 36000,
    maxPricePaise: 122400,
    description: `The flower that opens after dark and scents an entire courtyard.

This is a faithful jasmine sambac — indolic, green, slightly banana-sweet at the top — grounded on a thin sandalwood base so it does not turn soapy. Best applied in the evening.`,
    scentNotes: {
      top: ['Green leaf', 'Neroli'],
      heart: ['Jasmine sambac', 'Tuberose'],
      base: ['Sandalwood', 'Soft musk'],
    },
    metaTitle: null,
    metaDescription: null,
    ...images(ART.jasmine, 'Raat Ki Rani jasmine attar bottle'),
    variants: variants(36000, [12, 5, 3]),
    categories: [mockCategories[1]!],
    reviews: reviews(['Meera T.', 'Arnab C.'], 'jasmine'),
    ratingAvg: 4.5,
    ratingCount: 2,
    inStock: true,
  },
  {
    id: 106,
    slug: 'chandan-shuddh',
    name: 'Chandan Shuddh',
    tagline: 'Pure sandalwood, creamy and meditative',
    scentFamily: 'Oud',
    isFeatured: false,
    minPricePaise: 52000,
    maxPricePaise: 176800,
    description: `Single-note sandalwood, and the most expensive oil we bottle.

Creamy, dry, faintly sour in the way genuine sandal always is — nothing like the sweet "sandal" of commercial soap. Traditionally worn for prayer and still bought by our oldest customers for exactly that.

Stocks depend entirely on what we can source; this listing goes quiet for months at a time.`,
    scentNotes: {
      top: ['Sandalwood'],
      heart: ['Sandalwood', 'Vetiver'],
      base: ['Sandalwood', 'Cedar'],
    },
    metaTitle: null,
    metaDescription: null,
    ...images(ART.sandal, 'Chandan Shuddh sandalwood attar bottle'),
    variants: variants(52000, [3, 2, 0]),
    categories: [mockCategories[0]!],
    reviews: reviews(['Dr. S. Bose', 'Habib M.', 'Ritu K.'], 'sandalwood'),
    ratingAvg: 5,
    ratingCount: 3,
    inStock: true,
  },
];

export function toSummary(p: ProductDetail): ProductSummary {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    scentFamily: p.scentFamily,
    isFeatured: p.isFeatured,
    minPricePaise: p.minPricePaise,
    maxPricePaise: p.maxPricePaise,
    primaryImage: p.images.find((i) => i.isPrimary) ?? p.images[0] ?? null,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    inStock: p.variants.some((v) => v.inStock),
  };
}

export const mockProductSummaries: ProductSummary[] = mockProducts.map(toSummary);

export function mockProductBySlug(slug: string): ProductDetail | null {
  return mockProducts.find((p) => p.slug === slug) ?? null;
}

/* --------------------------------------------------------------- orders */

export const mockOrder: Order = {
  orderNumber: 'AWSB-2026-00417',
  status: 'shipped',
  paymentStatus: 'paid',
  subtotalPaise: 84000,
  discountPaise: 0,
  shippingPaise: 4900,
  totalPaise: 88900,
  currency: 'INR',
  couponCode: null,
  items: [
    {
      variantId: 1,
      productName: 'Waalid Shamama',
      productSlug: 'waalid-shamama',
      sizeMl: 6,
      sku: 'AWSB-WSH-06',
      unitPricePaise: 45000,
      quantity: 1,
      lineTotalPaise: 45000,
      imageUrl: ART.oud,
    },
    {
      variantId: 2,
      productName: 'Gulab-e-Bangla',
      productSlug: 'gulab-e-bangla',
      sizeMl: 3,
      sku: 'AWSB-GEB-03',
      unitPricePaise: 39000,
      quantity: 1,
      lineTotalPaise: 39000,
      imageUrl: ART.rose,
    },
  ],
  shippingAddress: {
    fullName: 'Soumya Bhattacharya',
    phone: '9830012345',
    altPhone: '9038571860',
    email: 'soumya@example.com',
    line1: 'Flat 4B, Ashiana Apartments',
    line2: 'Sector V, Salt Lake',
    landmark: 'Near Technopolis',
    city: 'Kolkata',
    district: 'North 24 Parganas',
    state: 'West Bengal',
    pincode: '700091',
    country: 'IN',
  },
  shipZone: 'kolkata',
  customerNote: null,
  shipment: {
    id: 1,
    courierName: 'Delhivery',
    courierSlug: 'delhivery',
    trackingNumber: '2841097654321',
    trackingUrl: 'https://www.delhivery.com/tracking?trackingId=2841097654321',
    supportsDeepLink: true,
    shippedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    deliveredAt: null,
  },
  placedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  shippedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  deliveredAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
};

/* ---------------------------------------------------------------- admin */

export const mockAdminOrders: AdminOrderSummary[] = [
  {
    id: 417,
    orderNumber: 'AWSB-2026-00417',
    status: 'confirmed',
    paymentStatus: 'paid',
    totalPaise: 88900,
    itemCount: 2,
    shipFullName: 'Soumya Bhattacharya',
    shipCity: 'Kolkata',
    shipPincode: '700091',
    shipZone: 'kolkata',
    placedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
  {
    id: 416,
    orderNumber: 'AWSB-2026-00416',
    status: 'packed',
    paymentStatus: 'paid',
    totalPaise: 62900,
    itemCount: 1,
    shipFullName: 'Ritika Agarwal',
    shipCity: 'Pune',
    shipPincode: '411014',
    shipZone: 'rest_of_india',
    placedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  },
  {
    id: 415,
    orderNumber: 'AWSB-2026-00415',
    status: 'shipped',
    paymentStatus: 'paid',
    totalPaise: 181900,
    itemCount: 3,
    shipFullName: 'Abdul Rahman',
    shipCity: 'Hyderabad',
    shipPincode: '500028',
    shipZone: 'rest_of_india',
    placedAt: new Date(Date.now() - 52 * 3_600_000).toISOString(),
    createdAt: new Date(Date.now() - 52 * 3_600_000).toISOString(),
  },
  {
    id: 414,
    orderNumber: 'AWSB-2026-00414',
    status: 'delivered',
    paymentStatus: 'paid',
    totalPaise: 44900,
    itemCount: 1,
    shipFullName: 'Piyali Sen',
    shipCity: 'Kolkata',
    shipPincode: '700029',
    shipZone: 'kolkata',
    placedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  },
  {
    id: 413,
    orderNumber: 'AWSB-2026-00413',
    status: 'cancelled',
    paymentStatus: 'refunded',
    totalPaise: 51900,
    itemCount: 1,
    shipFullName: 'Nikhil Verma',
    shipCity: 'Howrah',
    shipPincode: '711101',
    shipZone: 'rest_of_india',
    placedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  },
];

export const mockAdminOrderDetail: AdminOrderDetail = {
  ...mockOrder,
  id: 417,
  customerId: null,
  adminNote: null,
  shipEmail: mockOrder.shippingAddress.email,
  shipPhone: mockOrder.shippingAddress.phone,
  status: 'confirmed',
  shipment: null,
  shippedAt: null,
  payment: {
    razorpayOrderId: 'order_QmXk2sample9',
    razorpayPaymentId: 'pay_QmXk4sample2',
    method: 'upi',
    status: 'captured',
    amountPaise: 88900,
    errorDescription: null,
  },
};

export const mockDashboard: AdminDashboard = {
  today: { revenuePaise: 151800, orderCount: 3 },
  last7Days: { revenuePaise: 894300, orderCount: 14 },
  last30Days: { revenuePaise: 3421700, orderCount: 52 },
  allTime: { revenuePaise: 18734500, orderCount: 287 },
  ordersByStatus: {
    pending_payment: 2,
    confirmed: 5,
    packed: 3,
    shipped: 7,
    delivered: 268,
    cancelled: 2,
    refunded: 0,
  },
  topProducts: [
    { productId: 102, name: 'Gulab-e-Bangla', slug: 'gulab-e-bangla', unitsSold: 84, revenuePaise: 3721000 },
    { productId: 101, name: 'Waalid Shamama', slug: 'waalid-shamama', unitsSold: 61, revenuePaise: 3294000 },
    { productId: 103, name: 'Mushk al-Layl', slug: 'mushk-al-layl', unitsSold: 57, revenuePaise: 2158000 },
    { productId: 104, name: 'Ambar Sonali', slug: 'ambar-sonali', unitsSold: 38, revenuePaise: 1806000 },
    { productId: 106, name: 'Chandan Shuddh', slug: 'chandan-shuddh', unitsSold: 19, revenuePaise: 1284000 },
  ],
  lowStock: [
    { variantId: 9, productId: 106, productName: 'Chandan Shuddh', productSlug: 'chandan-shuddh', sizeMl: 12, sku: 'AWSB-CHS-12', stockQty: 0, lowStockThreshold: 5 },
    { variantId: 8, productId: 106, productName: 'Chandan Shuddh', productSlug: 'chandan-shuddh', sizeMl: 6, sku: 'AWSB-CHS-06', stockQty: 2, lowStockThreshold: 5 },
    { variantId: 7, productId: 104, productName: 'Ambar Sonali', productSlug: 'ambar-sonali', sizeMl: 12, sku: 'AWSB-AMS-12', stockQty: 0, lowStockThreshold: 5 },
    { variantId: 6, productId: 105, productName: 'Raat Ki Rani', productSlug: 'raat-ki-rani', sizeMl: 12, sku: 'AWSB-RKR-12', stockQty: 3, lowStockThreshold: 5 },
    { variantId: 5, productId: 101, productName: 'Waalid Shamama', productSlug: 'waalid-shamama', sizeMl: 12, sku: 'AWSB-WSH-12', stockQty: 4, lowStockThreshold: 5 },
  ],
  recentOrders: mockAdminOrders,
  pendingReviewCount: 3,
  newFeedbackCount: 2,
};

/**
 * Couriers, matching the verified seed in docs/02-couriers.md.
 * supports_deep_link = false marks the CAPTCHA-gated ones.
 */
export const mockCouriers: Courier[] = [
  { id: 1, name: 'Blue Dart', slug: 'bluedart', trackingUrlTemplate: 'https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo={TRACKING_NUMBER}', supportsDeepLink: true, awbPattern: '^[0-9]{8,11}$', phone: null, isActive: true, sortOrder: 10 },
  { id: 2, name: 'Delhivery', slug: 'delhivery', trackingUrlTemplate: 'https://www.delhivery.com/tracking?trackingId={TRACKING_NUMBER}', supportsDeepLink: true, awbPattern: '^[A-Z]{0,3}[0-9]{11,15}$', phone: null, isActive: true, sortOrder: 20 },
  { id: 3, name: 'XpressBees', slug: 'xpressbees', trackingUrlTemplate: 'https://www.xpressbees.com/track?isawb=Yes&trackid={TRACKING_NUMBER}', supportsDeepLink: true, awbPattern: '^([0-9]{13,14}|[A-Z]{2}[0-9]{12})$', phone: null, isActive: true, sortOrder: 30 },
  { id: 4, name: 'Ekart', slug: 'ekart', trackingUrlTemplate: 'https://ekartlogistics.com/shipmenttrack/{TRACKING_NUMBER}', supportsDeepLink: true, awbPattern: '^(FMPC|FMPP)[0-9]{10}$', phone: null, isActive: true, sortOrder: 40 },
  { id: 5, name: 'Amazon Shipping', slug: 'amazon', trackingUrlTemplate: 'https://track.amazon.in/tracking/{TRACKING_NUMBER}', supportsDeepLink: true, awbPattern: '^TBA[0-9A-Z]{9,12}$', phone: null, isActive: true, sortOrder: 50 },
  { id: 6, name: 'India Post', slug: 'indiapost', trackingUrlTemplate: 'https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx', supportsDeepLink: false, awbPattern: '^[A-Z]{2}[0-9]{9}IN$', phone: null, isActive: true, sortOrder: 60 },
  { id: 7, name: 'DTDC', slug: 'dtdc', trackingUrlTemplate: 'https://www.dtdc.com/track-your-shipment/', supportsDeepLink: false, awbPattern: null, phone: null, isActive: true, sortOrder: 70 },
  { id: 8, name: 'Professional Couriers', slug: 'tpc', trackingUrlTemplate: 'https://www.tpcindia.com/track-info.aspx', supportsDeepLink: false, awbPattern: null, phone: null, isActive: true, sortOrder: 80 },
  { id: 9, name: 'Trackon', slug: 'trackon', trackingUrlTemplate: 'https://www.trackon.in/courier-tracking', supportsDeepLink: false, awbPattern: null, phone: null, isActive: true, sortOrder: 90 },
];
