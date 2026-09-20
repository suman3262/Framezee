# Framezee — Architecture

Custom photo-frame e-commerce. India only. Frame manufacturing hub selling direct.

Status: design approved, not yet built.

---

## 1. What this app is

Two hard parts. Everything else is CRUD.

**A pricing engine, not a SKU catalog.** Nothing is priced by hand. Price is computed from
`size × material (× paper)` against rate bands the super-admin sets. No variant explosion,
no 10,000 SKUs.

**An image pipeline.** Customer uploads a photo of their wall, places a frame on it, drags it
into position, and sees the result before paying. Optionally uploads a photo for us to print,
mount and ship.

---

## 2. Scope

| | |
|---|---|
| Market | India only, INR |
| Catalog | Ready-made artwork frames + fully custom sizes |
| Custom size | Free dimension entry within a per-material min/max range |
| Print service | Optional add-on. Customer uploads a photo, we print + bind + ship |
| Payments | Razorpay at launch. COD later (a flag on the order, not a second integration) |
| Shipping | Flat rate. Shiprocket used **after** payment for fulfilment + tracking |
| Tax | GST. CGST+SGST within West Bengal, IGST elsewhere |
| Accounts | Login required to buy. No guest checkout |
| Bulk orders | Out of scope — "contact us" |
| Languages | English only |

---

## 3. Shape

**One Next.js app.** Storefront and admin share a codebase, a database and a deploy.

```
framezee/
  app/
    (shop)/          storefront
    (admin)/         /admin/*  — role-gated in middleware
    api/
      webhooks/razorpay
      webhooks/shiprocket
      uploads/sign
  lib/
    pricing.ts       the money function — single source of truth
    tax.ts
    shiprocket.ts
    razorpay.ts
  db/schema.ts
```

Two separate apps would mean two deploys, duplicated types and a shared-package build — for
one team and one database. Skipped.

### Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js App Router, TypeScript | One deploy; SSR for product-page SEO |
| DB | Postgres | Rate bands and order snapshots are relational; JSONB for transforms |
| ORM | Drizzle | Thin, typed SQL |
| Auth / DB / Storage | Supabase | One vendor, one free tier, three problems solved. Phone OTP built in |
| Payments | Razorpay + webhook | |
| Shipping | Shiprocket REST + tracking webhook | |
| Images | sharp, on demand | |
| UI | Tailwind + shadcn/ui | Admin screens are stock data-table patterns |
| Hosting | Vercel | Free tier covers launch volume |

**Deliberately skipped:** microservices, GraphQL, Redis, job queue, Docker/k8s, separate admin
app, state-management library, CDN config. Add when a real number forces it.

---

## 4. The image pipeline

| Step | How |
|---|---|
| Upload | Presigned direct-to-storage. Never through the app server |
| Position | Browser canvas — it already holds the image, no round-trip |
| Save | Store the **transform** (`{x, y, scale, rotation}`) as JSON. Not a rendered composite |
| Preview | Re-render from the transform client-side |
| Print file | `sharp`, rendered **on demand** when admin clicks *Download print file* |

Rendering on demand removes a job queue, a worker fleet and Redis. Roughly 30 renders a day,
each triggered by a human — a queue for that is infrastructure that pages you at 3am.

Two distinct images, with different rules:

- **Room photo** — preview only. Compressed, disposable after the order ships.
- **Print photo** — production critical. Original resolution, retained.

**DPI guard:** `photo_px / print_inches >= 150`, checked in the browser at upload. Warns the
customer before they buy a blurry ₹2,000 print. A few lines; prevents refunds.

---

## 5. Money rules (not negotiable)

**Prices freeze at order time.** Super-admin changes ₹4 → ₹5/sq·in and every past order,
invoice and open cart keeps its original number.

- `order_items` stores the full computed breakdown as a **snapshot**, plus material and paper
  **names as text**. Never a foreign key to a live, editable rate.
- Carts do **not** snapshot — a cart is not money yet, so it recomputes live. Price is locked
  at the moment the order row is created.
- Coupons store the **discount amount applied**, not just the code.

The money path is exactly three modules, each with its own test file, and nothing else in the
app multiplies money:

| | |
|---|---|
| `lib/pricing.ts` | prices one line from size × material (× paper) |
| `lib/coupons.ts` | validates a code and returns the discount |
| `lib/tax.ts` | splits the GST already inside the price |

**Coupon rules:** the discount applies to the goods subtotal only, never to shipping. A
discount can never exceed the order — a flat ₹5,000 code on a ₹300 order takes ₹300, not a
negative total. Rejections return a reason and a sentence for the checkout to show ("Add ₹75
more to use FRAME10"), because entering a code that doesn't apply is normal customer
behaviour, not an exception.

`ponytail:` no per-user usage limit — only the global `usage_limit` and the new-customer rule,
which is `customerOrderCount === 0`. Add a per-user cap if a code gets abused.

### The price function

```
price(width_in, height_in, material, paper?, qty):
  area   = width_in * height_in
  band   = first material_rate where width <= max_width and height <= max_height
  frame  = area * band.rate_per_sq_in
  print  = paper ? area * paper_band.rate_per_sq_in : 0
  unit   = round(frame + print)
  total  = unit * qty
```

Bands are ordered smallest-first; the first match wins. No band matches → the size is out of
range and the server rejects it.

**A band's dimensions only select the rate — they never enter the multiplication.** The rate
is charged against the frame's *actual* area.

```
40 × 60 in, teak wood, band "under 100×100 in → ₹4/sq·in"

  area  = 40 × 60    = 2,400 sq·in
  frame = 2,400 × 4  = ₹9,600

with "A" quality paper @ ₹2/sq·in:

  print = 2,400 × 2  = ₹4,800
  unit  =              ₹14,400
```

No price is ever hardcoded and no price is ever hand-entered. Super-admin sets the range and
the rate; the app multiplies.

### Tax

Seller is in West Bengal (Nadia).

- Ship-to state = West Bengal → CGST + SGST (half each)
- Any other state → IGST (full rate)

GST rate lives **on the material row**, because wood and metal frames differ. HSN code per
material too. *Confirm rates and HSN with your CA before launch.*

The customer pays the same amount either way. Only the split shown on the invoice changes.

**Prices are GST-inclusive.** A rate of ₹4/sq·in produces the **final** price. Tax is worked
backwards out of it for the invoice, never added at checkout.

```
₹154 inclusive @ 12%  ->  taxable value ₹137.50 + GST ₹16.50  =  ₹154.00
```

Two consequences, both deliberate:

- The customer's total is exactly `subtotal − discount + shipping`. The number on the product
  card is the number on the card statement. No checkout surprise, which is what Indian D2C
  buyers expect.
- **Turning GST on changes no price anywhere** — only the invoice gains a breakdown. The day
  the GSTIN lands is a config change, not a repricing.

Order of operations, which is the order the GST rules require:

1. **Discount first**, spread across lines by value
2. **Shipping added**, spread the same way — composite supply, so shipping carries the rate of
   the goods it ships
3. **Tax extracted per line at its own rate**, because wood (12%) and metal (18%) differ

Shares are apportioned with largest-remainder and the taxable value is derived by subtraction,
so the parts always add up to the whole. Naive rounding leaves a stray paisa and then the
invoice doesn't balance.

GSTIN arrives ~1 week after this doc. Tax is built now and switched on with
`settings.gst_enabled` — retrofitting tax into an order model that already has live orders is
painful. Until then `calcTax` runs with the switch off and charges nothing.

---

## 6. Data model

~17 tables.

```sql
users                 id, phone, email, name,
                      role ∈ (customer | admin | super_admin), created_at

addresses             user_id, name, phone, line1, line2, city, state,
                      pincode, is_default

categories            slug, name, image, sort_order, active
                      -- Anime, Nature, Space, Car, Bike, City, Abstract, Botanical

sizes                 width_in, height_in, orientation, sort_order, active
                      -- the "Shop by Size" quick-pick grid

-- ── catalog ───────────────────────────────────────────────────────────────
products              slug, title, category_id, artwork_image,
                      default_material_id, active
                      -- price is COMPUTED, never stored. "from ₹140" is a
                      -- min over the size range

-- ── pricing control (super-admin) ─────────────────────────────────────────
materials             name, kind, description, image, gst_rate, hsn_code,
                      min_width_in, max_width_in, min_height_in, max_height_in,
                      active
                      -- kind = 'wood' | 'metal' | … , free text, admin-listed

material_rates        material_id, max_width_in, max_height_in,
                      rate_per_sq_in, effective_from, active
                      -- "under 100×100in → ₹4/sq·in"

paper_qualities       name, description, gst_rate, hsn_code, active

paper_rates           paper_quality_id, max_width_in, max_height_in,
                      rate_per_sq_in, effective_from, active

-- ── custom studio ─────────────────────────────────────────────────────────
custom_designs        user_id, room_image_path, print_image_path,
                      transform jsonb, width_in, height_in,
                      material_id, paper_quality_id, created_at

-- ── cart ──────────────────────────────────────────────────────────────────
carts                 user_id
cart_items            cart_id, kind ∈ (catalog | custom),
                      product_id?, custom_design_id?,
                      width_in, height_in, material_id,
                      paper_quality_id?, print_service, qty
                      -- no price column: recomputed live

-- ── orders ────────────────────────────────────────────────────────────────
orders                order_no, user_id,
                      status ∈ (paid | ready_to_ship | shipped |
                                delivered | cancelled | refunded),
                      payment_method ∈ (razorpay | cod),
                      address jsonb,          -- snapshot
                      subtotal, coupon_code, coupon_discount,
                      shipping, cgst, sgst, igst, total,
                      seller_gstin, placed_at, notes

order_items           order_id, kind, title, width_in, height_in,
                      material_name, paper_name, print_service, qty,
                      unit_price, line_total,
                      price_breakdown jsonb,   -- snapshot
                      hsn_code, gst_rate,
                      print_image_path, transform jsonb
                      -- names are TEXT, not FKs. Invoices must survive
                      -- a material being renamed or deleted

payments              order_id, provider, razorpay_order_id,
                      razorpay_payment_id, signature, amount, status, raw jsonb

shipments             order_id, shiprocket_order_id, shipment_id, awb,
                      courier, status, tracking_url, last_event_at, raw jsonb

-- ── coupons ───────────────────────────────────────────────────────────────
coupons               code, type ∈ (percent | flat), value,
                      min_order_amount, max_discount, new_customers_only,
                      starts_at, ends_at, usage_limit, used_count, active

coupon_redemptions    coupon_id, user_id, order_id
                      -- enforces per-user limits and the new-customer rule

-- ── config ────────────────────────────────────────────────────────────────
settings              single row: seller_gstin, seller_state,
                      flat_shipping_rate, free_shipping_threshold,
                      cod_enabled, gst_enabled
```

**Simplifications taken:**

- `materials.kind` is a text column, not a `material_categories` table. One table instead of
  two joined ones. `ponytail:` promote to its own table if categories ever need their own
  images, ordering or descriptions.
- No `shipment_events` history table — latest status plus Shiprocket's tracking URL covers
  customer tracking. `ponytail:` add the table if you ever need to chart delivery times.
- No `audit_log`. With two staff, the risk doesn't justify the table. Add it when three or
  more people can change prices.
- No rate-card version entity. Order snapshots make historical rates unnecessary.

---

## 7. Order lifecycle

```
              Razorpay webhook: payment captured
                          │
                          ▼
                       [ paid ]
                          │
                          │  admin clicks "Ready to ship"
                          │  → creates Shiprocket order + AWB
                          ▼
                 [ ready_to_ship ]
                          │
                          │  Shiprocket webhook
                          ▼
                     [ shipped ]
                          │
                          │  Shiprocket webhook
                          ▼
                    [ delivered ]

    any pre-ship state → [ cancelled ] → [ refunded ]
```

**Exactly one manual click in the whole flow.** Everything before it is driven by Razorpay,
everything after by Shiprocket. The frame gets built off-system — the admin reads the order
page, downloads the print file, and clicks *Ready to ship* when it's packed.

No `in_production` status: it would need a second manual click that nobody reliably makes, and
a status nobody updates is worse than no status, because you start trusting wrong numbers.

**Order is created only after payment succeeds.** Before that it's a cart plus a Razorpay
order id. No pending-order rows to reconcile.

---

## 8. Admin

Two roles. One `role` column, checked in middleware.

| Screen | admin | super_admin |
|---|:---:|:---:|
| Dashboard | ✅ | ✅ |
| Orders (Shiprocket hub) | ✅ | ✅ |
| Products & Frames | ✅ | ✅ |
| Categories | ✅ | ✅ |
| Revenue & Analytics | — | ✅ |
| Staff & Permissions | — | ✅ |
| Coupons | — | ✅ |
| Price & Material Control | — | ✅ |

Removed from the Figma design: *Custom Studio Jobs*, *Settings*.

**Price & Material Control** absorbs what the Settings tab would have held: materials, material
rate bands, paper qualities, paper rate bands, flat shipping rate, GST config, COD toggle.

A granular per-permission matrix is a feature for twenty staff. You have two. `ponytail:` the
role column becomes a permissions table when a third role appears.

---

## 9. Integrations

**Razorpay** — create order at checkout, verify signature, treat the **webhook** as the source
of truth for payment success. Never trust the browser callback alone.

**Shiprocket** — auth token expires roughly every 10 days. Refresh it lazily on `401` and
cache it; this is the usual failure point in Shiprocket integrations. Called at *Ready to ship*
to create the shipment and AWB, then inbound webhooks drive `shipped` and `delivered`.

**Storage** — presigned PUT for uploads. Print images stay private; signed URLs only.

---

## 10. Known ceilings

`ponytail:` print-file rendering runs in a serverless request with a timeout ceiling. Large
files → move that one route to a background function or a small VPS. Not a launch problem.

`ponytail:` product listing recomputes "from ₹x" per render. Fine at this catalog size; cache
or denormalise a `min_price` column if listings get slow.

---

## 11. Design source

Figma: `J19lkxLjAtzLJSyC1saRNB`

- Client page `0:1` — home only (desktop 1280 + mobile 390). PDP, cart, checkout and custom
  studio screens not yet designed.
- Super-admin page `3:2` — Dashboard, Orders, Products & Frames, Categories, Revenue &
  Analytics, Staff & Permissions.
