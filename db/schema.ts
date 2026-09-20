import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Units, everywhere, always integers — see lib/pricing.ts
 *   *Tenths  tenths of an inch   (40 in -> 400)
 *   *Paise   paise               (Rs 140 -> 14000)
 *   rate     paise per sq inch   (Rs 4/sq-in -> 400)
 */

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const roleEnum = pgEnum('role', ['customer', 'admin', 'super_admin'])
/** Role says which pages; permission says whether they may change anything on them. */
export const permissionEnum = pgEnum('permission', ['read', 'read_write'])
export const orderStatusEnum = pgEnum('order_status', [
  'paid',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
])
export const paymentMethodEnum = pgEnum('payment_method', ['razorpay', 'cod'])
export const itemKindEnum = pgEnum('item_kind', ['catalog', 'custom'])
export const couponTypeEnum = pgEnum('coupon_type', ['percent', 'flat'])

// ── people ──────────────────────────────────────────────────────────────────

/** Mirrors Supabase auth.users. Auth lives there; everything app-side keys off here. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // = auth.users.id
  // Unique: one account per mobile number. This is what makes the new-customer
  // coupon rule hold — a second account needs a second phone.
  phone: text('phone').unique(),
  email: text('email'),
  name: text('name'),
  role: roleEnum('role').notNull().default('customer'),
  permission: permissionEnum('permission').notNull().default('read'),
  /** Set to refuse the dashboard without taking the role away. Null means active. */
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  /** Email of the super-admin who granted this, kept as text so it outlives them. */
  grantedBy: text('granted_by'),
  // Which messages this customer wants. Absent means the defaults in lib/preferences.ts.
  preferences: jsonb('preferences'),
  createdAt: createdAt(),
})

export const addresses = pgTable('addresses', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label'), // "Home", "Studio" — what the customer calls this address
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  state: text('state').notNull(), // drives CGST+SGST vs IGST
  pincode: text('pincode').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: createdAt(),
})

// ── catalog ─────────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  icon: text('icon'), // the emoji shown on the category pill
  image: text('image'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

/** The "Shop by Size" quick-pick grid. Custom sizes are not rows here. */
export const sizes = pgTable('sizes', {
  id: id(),
  widthTenths: integer('width_tenths').notNull(),
  heightTenths: integer('height_tenths').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

/** Ready-made artwork. Price is COMPUTED — "from Rs x" is a min over the size range. */
export const products = pgTable('products', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  artworkImage: text('artwork_image').notNull(),
  /**
   * The admin calls this the "preselected finish", because that is all it does: it picks
   * the chip that starts selected and the rate card the "from Rs x" is quoted against.
   * It does NOT limit which finishes a frame offers — every Offered moulding shows on
   * every frame. The column keeps its old name; renaming it would churn a migration for
   * a word nobody outside this file reads.
   */
  defaultMaterialId: uuid('default_material_id'),
  active: boolean('active').notNull().default(true),

  // PDP content
  number: text('number'), // "003" — the No. shown above the title
  description: text('description'),
  isNew: boolean('is_new').notNull().default(false),
  specs: jsonb('specs'), // { moulding, material, glazing, hanging }
  ratingTenths: integer('rating_tenths'), // 4.7 -> 47, denormalised from reviews
  ratingCount: integer('rating_count').notNull().default(0),

  createdAt: createdAt(),
})

/** Customer reviews shown on the product page. */
export const reviews = pgTable('reviews', {
  id: id(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(), // 1-5
  title: text('title').notNull(),
  body: text('body').notNull(),
  verified: boolean('verified').notNull().default(false),
  createdAt: createdAt(),
})

// ── pricing control (super-admin) ───────────────────────────────────────────

export const materials = pgTable('materials', {
  id: id(),
  slug: text('slug').notNull().unique(), // maple, walnut, aluminium …
  name: text('name').notNull(), // Teak Wood, Aluminium
  kind: text('kind').notNull(), // wood | metal | … — a label, admin-listed
  swatch: text('swatch').notNull().default('#cccccc'), // the dot on the FINISH chip
  description: text('description'),
  image: text('image'),
  gstRateBp: integer('gst_rate_bp').notNull(), // basis points: 12% -> 1200
  hsnCode: text('hsn_code'),
  minWidthTenths: integer('min_width_tenths').notNull(),
  maxWidthTenths: integer('max_width_tenths').notNull(),
  minHeightTenths: integer('min_height_tenths').notNull(),
  maxHeightTenths: integer('max_height_tenths').notNull(),
  active: boolean('active').notNull().default(true),
})

/**
 * How thick the moulding is. Was two constants in lib/frame-options.ts; a thin moulding
 * bows under a big sheet of glazing, so a thickness can cap the frame it is offered on.
 */
export const frameThicknesses = pgTable('frame_thicknesses', {
  id: id(),
  tenths: integer('tenths').notNull().unique(), // 5 = half an inch
  label: text('label').notNull(),
  maxLongTenths: integer('max_long_tenths'), // null = no limit
  maxShortTenths: integer('max_short_tenths'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

/** The mat board's rate card. No rows at all means free — same rule as glazing. */
export const matRates = pgTable('mat_rates', {
  id: id(),
  maxWidthTenths: integer('max_width_tenths').notNull(),
  maxHeightTenths: integer('max_height_tenths').notNull(),
  ratePaisePerSqIn: integer('rate_paise_per_sq_in').notNull(),
  active: boolean('active').notNull().default(true),
})

/** "under 100x100 in -> Rs 4/sq-in". The band selects the rate; area does the math. */
export const materialRates = pgTable('material_rates', {
  id: id(),
  materialId: uuid('material_id')
    .notNull()
    .references(() => materials.id, { onDelete: 'cascade' }),
  maxWidthTenths: integer('max_width_tenths').notNull(),
  maxHeightTenths: integer('max_height_tenths').notNull(),
  ratePaisePerSqIn: integer('rate_paise_per_sq_in').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  active: boolean('active').notNull().default(true),
})

export const paperQualities = pgTable('paper_qualities', {
  id: id(),
  name: text('name').notNull(), // "A quality", Glossy 250gsm
  description: text('description'),
  gstRateBp: integer('gst_rate_bp').notNull(),
  hsnCode: text('hsn_code'),
  active: boolean('active').notNull().default(true),
})

export const paperRates = pgTable('paper_rates', {
  id: id(),
  paperQualityId: uuid('paper_quality_id')
    .notNull()
    .references(() => paperQualities.id, { onDelete: 'cascade' }),
  maxWidthTenths: integer('max_width_tenths').notNull(),
  maxHeightTenths: integer('max_height_tenths').notNull(),
  ratePaisePerSqIn: integer('rate_paise_per_sq_in').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  active: boolean('active').notNull().default(true),
})

/** Protective glazing. The standard one is included; upgrades price per square inch. */
export const glazingOptions = pgTable('glazing_options', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  included: boolean('included').notNull().default(false),
  gstRateBp: integer('gst_rate_bp').notNull(),
  hsnCode: text('hsn_code'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

export const glazingRates = pgTable('glazing_rates', {
  id: id(),
  glazingOptionId: uuid('glazing_option_id')
    .notNull()
    .references(() => glazingOptions.id, { onDelete: 'cascade' }),
  maxWidthTenths: integer('max_width_tenths').notNull(),
  maxHeightTenths: integer('max_height_tenths').notNull(),
  ratePaisePerSqIn: integer('rate_paise_per_sq_in').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  active: boolean('active').notNull().default(true),
})

// ── custom studio ───────────────────────────────────────────────────────────

/**
 * A frame the customer configured themselves.
 *
 * `printImagePath` is the photo that gets printed and mounted — the only upload the
 * workshop needs. The wall behind the preview and where the frame was dragged on it are
 * deliberately not here: they help someone picture the result and have no bearing on what
 * is cut, printed or shipped.
 */
export const customDesigns = pgTable('custom_designs', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  printImagePath: text('print_image_path'),
  widthTenths: integer('width_tenths').notNull(),
  heightTenths: integer('height_tenths').notNull(),
  materialId: uuid('material_id').references(() => materials.id),
  paperQualityId: uuid('paper_quality_id').references(() => paperQualities.id),
  glazingOptionId: uuid('glazing_option_id').references(() => glazingOptions.id),
  thicknessTenths: integer('thickness_tenths').notNull().default(10),
  matBoard: boolean('mat_board').notNull().default(false),
  matColour: text('mat_colour'), // 'white' | 'black'
  createdAt: createdAt(),
})

/**
 * Saved frames. A wishlist entry is a whole configuration, not just a product, because a
 * customer saves "this frame at this size in this moulding" — that is what they come back
 * for, and it is what moves to the basket in one click.
 */
export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    widthTenths: integer('width_tenths').notNull(),
    heightTenths: integer('height_tenths').notNull(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    glazingOptionId: uuid('glazing_option_id').references(() => glazingOptions.id),
    thicknessTenths: integer('thickness_tenths').notNull().default(10),
    matBoard: boolean('mat_board').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    // Saving the same configuration twice is a no-op, not a duplicate row.
    uniqueIndex('wishlist_one_per_config').on(
      t.userId,
      t.productId,
      t.widthTenths,
      t.heightTenths,
      t.materialId,
      t.thicknessTenths,
      t.matBoard,
    ),
  ],
)

// ── cart ────────────────────────────────────────────────────────────────────

export const carts = pgTable('carts', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  // The code the customer typed. Only the code — the discount is recomputed on every
  // render, so a coupon that expires while the basket sits there stops applying.
  couponCode: text('coupon_code'),
  createdAt: createdAt(),
})

/** No price column — a cart is not money yet, so it recomputes live on every view. */
export const cartItems = pgTable('cart_items', {
  id: id(),
  cartId: uuid('cart_id')
    .notNull()
    .references(() => carts.id, { onDelete: 'cascade' }),
  kind: itemKindEnum('kind').notNull(),
  productId: uuid('product_id').references(() => products.id),
  customDesignId: uuid('custom_design_id').references(() => customDesigns.id),
  widthTenths: integer('width_tenths').notNull(),
  heightTenths: integer('height_tenths').notNull(),
  materialId: uuid('material_id')
    .notNull()
    .references(() => materials.id),
  paperQualityId: uuid('paper_quality_id').references(() => paperQualities.id),
  glazingOptionId: uuid('glazing_option_id').references(() => glazingOptions.id),
  printService: boolean('print_service').notNull().default(false),
  thicknessTenths: integer('thickness_tenths').notNull().default(10), // 1/2 in -> 5, 1 in -> 10
  matBoard: boolean('mat_board').notNull().default(false),
  qty: integer('qty').notNull().default(1),
  createdAt: createdAt(),
})

// ── orders ──────────────────────────────────────────────────────────────────

/** Created only after Razorpay confirms payment. No pending rows to reconcile. */
export const orders = pgTable('orders', {
  id: id(),
  orderNo: text('order_no').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  status: orderStatusEnum('status').notNull().default('paid'),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  address: jsonb('address').notNull(), // snapshot — never a FK
  subtotalPaise: integer('subtotal_paise').notNull(),
  couponCode: text('coupon_code'),
  couponDiscountPaise: integer('coupon_discount_paise').notNull().default(0),
  shippingPaise: integer('shipping_paise').notNull().default(0),
  cgstPaise: integer('cgst_paise').notNull().default(0),
  sgstPaise: integer('sgst_paise').notNull().default(0),
  igstPaise: integer('igst_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull(),
  sellerGstin: text('seller_gstin'),
  notes: text('notes'),
  placedAt: createdAt(),
})

/**
 * Names are TEXT, not foreign keys, and prices are frozen here at order time.
 * Renaming a material or changing a rate must never alter a past invoice.
 */
export const orderItems = pgTable('order_items', {
  id: id(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  kind: itemKindEnum('kind').notNull(),
  title: text('title').notNull(),
  widthTenths: integer('width_tenths').notNull(),
  heightTenths: integer('height_tenths').notNull(),
  materialName: text('material_name').notNull(),
  paperName: text('paper_name'),
  glazingName: text('glazing_name'),
  matColour: text('mat_colour'),
  printService: boolean('print_service').notNull().default(false),
  thicknessTenths: integer('thickness_tenths').notNull().default(10),
  matBoard: boolean('mat_board').notNull().default(false),
  qty: integer('qty').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  linePaise: integer('line_paise').notNull(),
  priceBreakdown: jsonb('price_breakdown').notNull(), // LineBreakdown from lib/pricing.ts
  hsnCode: text('hsn_code'),
  gstRateBp: integer('gst_rate_bp').notNull(),
  printImagePath: text('print_image_path'),
})

export const payments = pgTable('payments', {
  id: id(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('razorpay'),
  razorpayOrderId: text('razorpay_order_id'),
  razorpayPaymentId: text('razorpay_payment_id').unique(),
  signature: text('signature'),
  amountPaise: integer('amount_paise').notNull(),
  status: text('status').notNull(),
  raw: jsonb('raw'),
  createdAt: createdAt(),
})

/** Created when admin clicks "Ready to ship". Webhooks drive status from there. */
export const shipments = pgTable('shipments', {
  id: id(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  shiprocketOrderId: text('shiprocket_order_id'),
  shipmentId: text('shipment_id'),
  awb: text('awb'),
  courier: text('courier'),
  status: text('status'),
  trackingUrl: text('tracking_url'),
  lastEventAt: timestamp('last_event_at', { withTimezone: true }),
  raw: jsonb('raw'),
  createdAt: createdAt(),
})

// ── coupons ─────────────────────────────────────────────────────────────────

export const coupons = pgTable('coupons', {
  id: id(),
  code: text('code').notNull().unique(),
  type: couponTypeEnum('type').notNull(),
  value: integer('value').notNull(), // percent -> basis points, flat -> paise
  minOrderPaise: integer('min_order_paise').notNull().default(0),
  maxDiscountPaise: integer('max_discount_paise'),
  newCustomersOnly: boolean('new_customers_only').notNull().default(false),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
})

/** Enforces per-user limits and the new-customer rule. */
export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: id(),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('coupon_once_per_order').on(t.couponId, t.orderId)],
)

// ── config ──────────────────────────────────────────────────────────────────

/** Single row. Lives behind the Price & Material Control tab. */
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  sellerGstin: text('seller_gstin'),
  sellerState: text('seller_state').notNull().default('West Bengal'),
  flatShippingPaise: integer('flat_shipping_paise').notNull().default(0),
  freeShippingThresholdPaise: integer('free_shipping_threshold_paise'),
  codEnabled: boolean('cod_enabled').notNull().default(false),
  gstEnabled: boolean('gst_enabled').notNull().default(false),
})
