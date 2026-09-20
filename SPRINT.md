# Framezee — Sprint Plan

The living record of this build: what works today, where it lives, what is left, and every
decision deferred along the way.

**How this file is kept**

- **Flow before status.** "The app today" below is the customer and staff journey as it
  actually runs, with the route and the file behind each step. Read that first.
- **Sprints run in order.** No jumping ahead, even when a later sprint looks easier.
- **Nothing is ticked until it runs.** Tests pass, or the page loads, or the action returns.
- **Flags are not fixed on the spot.** Anything noticed but not essential goes into the
  **Deferred register** at the bottom and is reviewed once all sprints are done. The one
  exception is a blocker: something that stops the current sprint finishing is solved then
  and there.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## The app today

### Customer journey

| # | Step | Route | Built in | Key files |
|---|---|---|---|---|
| 1 | Land on the shop | `/` | S2, restyled S4 | [app/(shop)/page.tsx](app/(shop)/page.tsx), [components/home/](components/home/) |
| 2 | Browse the gallery | `/browse`, `/browse?category=` | S4 | [app/(shop)/browse/page.tsx](app/(shop)/browse/page.tsx), [components/shop/frame-card.tsx](components/shop/frame-card.tsx) |
| 3 | Browse by size | `/sizes` | S4 | [app/(shop)/sizes/page.tsx](app/(shop)/sizes/page.tsx) |
| 4 | Configure a catalogue frame | `/frames/[slug]` | S4 | [app/(shop)/frames/[slug]/page.tsx](app/(shop)/frames/[slug]/page.tsx), [components/pdp/configurator.tsx](components/pdp/configurator.tsx) |
| 5 | Or build one from scratch | `/custom` | S5 | [app/(shop)/custom/page.tsx](app/(shop)/custom/page.tsx), [components/studio/studio.tsx](components/studio/studio.tsx) |
| 6 | Upload artwork / a wall photo | (in 5) | S5 | [components/studio/upload.ts](components/studio/upload.ts) → Supabase Storage `studio` bucket |
| 7 | Add to basket | server action | S4, S5 | [app/actions/cart.ts](app/actions/cart.ts), [app/actions/custom.ts](app/actions/custom.ts) |
| 8 | Sign in or sign up | `/sign-in`, `/sign-up` | S3, restyled S10 | [app/(auth)/sign-in/page.tsx](app/(auth)/sign-in/page.tsx), [app/(auth)/sign-up/page.tsx](app/(auth)/sign-up/page.tsx) |
| 8b | Save frames for later | `/wishlist` | S10 | [app/(shop)/wishlist/page.tsx](app/(shop)/wishlist/page.tsx) |
| 9 | Review the basket | `/cart` | S4 | [app/(shop)/cart/page.tsx](app/(shop)/cart/page.tsx) |
| 10 | Checkout | `/checkout` | S6 | [app/(shop)/checkout/page.tsx](app/(shop)/checkout/page.tsx) |
| 11 | Pay | — | **S6, blocked on Razorpay keys** | — |
| 12 | Track the order | — | S7 | — |
| 13 | Look something up | `/help` | S10 | [app/(shop)/help/page.tsx](app/(shop)/help/page.tsx) |
| 14 | Manage the account | `/account` + orders, addresses, preferences | S3, split S10 | [app/(shop)/account/page.tsx](app/(shop)/account/page.tsx), [app/actions/account.ts](app/actions/account.ts) |

### Staff journey

Staff do **not** sign in where customers do. The door is at an unguessable path, takes a
password and an authenticator code, and nothing links to it.

| # | Step | Route | Built in | Key files |
|---|---|---|---|---|
| 1 | Sign in as staff | `/framezee/a/auth/admin` | S12 | [components/admin/admin-sign-in.tsx](components/admin/admin-sign-in.tsx) — password, then TOTP; enrols a factor on first sign-in |
| 2 | Reach the admin | `/admin` | S12 | [lib/auth.ts](lib/auth.ts) — role **and** `aal2` **and** not suspended |
| 3 | Dashboard | `/admin` | S12 | [app/(admin)/admin/page.tsx](app/(admin)/admin/page.tsx) — six metrics, SVG intake chart, workshop backlog |
| 4 | Orders: search, advance, print files | `/admin/orders` | S12 | [app/(admin)/admin/orders/page.tsx](app/(admin)/admin/orders/page.tsx), [lib/artwork-file.ts](lib/artwork-file.ts) |
| 5 | Frames: add, edit, delete, upload artwork | `/admin/products` | S12 | [app/actions/product-admin.ts](app/actions/product-admin.ts), [lib/catalogue-upload.ts](lib/catalogue-upload.ts) |
| 6 | Categories: add, rename, reorder, delete | `/admin/categories` | S12 | [app/actions/category-admin.ts](app/actions/category-admin.ts) |
| 7 | Mouldings, glazing, papers, **sizes, thickness, mat** | `/admin/pricing` | S12 | [app/actions/material-admin.ts](app/actions/material-admin.ts), [app/actions/size-admin.ts](app/actions/size-admin.ts) |
| 8 | Coupons, revenue | `/admin/coupons`, `/admin/revenue` | S9 | — |
| 9 | Create admins, permissions, suspend, revoke | `/admin/staff` | S12 | [app/actions/staff-admin.ts](app/actions/staff-admin.ts) |

**Two levels of write access.** `role` says which pages; `permission` says whether they may
change anything. A read-only admin opens every page their role allows and changes nothing —
enforced by `requireWrite()` in the server actions, not by hiding buttons.

### How a price is reached

This is the part to understand before changing anything.

```
super-admin sets rate bands          material_rates / paper_rates / glazing_rates
        ↓
lib/pricing.ts     priceLine()       area × the band's rate, per line
        ↓
lib/coupons.ts     applyCoupon()     discount off the goods subtotal
        ↓
lib/tax.ts         calcTax()         pulls the GST back out of a GST-INCLUSIVE price
        ↓
order_items                          the numbers FREEZE here, as a snapshot
```

Nothing else in the app multiplies money. A cart recomputes live on every render; an order
never does.

### Guard rails already in place

| Guard | Where |
|---|---|
| Signed-out visitors bounced off private routes | [middleware.ts](middleware.ts) |
| Staff-only check before any admin page renders | [app/(admin)/layout.tsx](app/(admin)/layout.tsx) |
| `public.users` kept in step with `auth.users` | [db/migrations/0001_user_sync_trigger.sql](db/migrations/0001_user_sync_trigger.sql) |
| RLS on every table, so the browser key reads nothing | [db/migrations/0002_enable_rls.sql](db/migrations/0002_enable_rls.sql) |
| Uploads confined to the customer's own folder | [db/migrations/0004_glazing_and_studio.sql](db/migrations/0004_glazing_and_studio.sql) |
| Every form and action re-validated server-side | `app/actions/*.ts` |

---

## Where things live

```
app/
  layout.tsx               fonts, theme script
  globals.css              design tokens (PDP palette), light + dark
  (shop)/                  storefront — header, footer, mobile nav
  (auth)/sign-in/          sign-in, outside the shop chrome
  (admin)/                 role-gated; layout.tsx is the gate
  actions/                 server actions: auth, account, cart, custom,
                           product-admin, category-admin, material-admin,
                           size-admin, staff-admin, pricing-admin, coupon-admin
  (auth)/framezee/a/auth/admin/   the staff door — unguessable, noindex

components/
  site/                    header, footer, logo, top bars, theme toggle, mobile nav
  home/                    hero, promo banners, product card, section heading
  shop/                    frame card (listing pages)
  pdp/                     configurator, frame preview, reviews, stars
  studio/                  studio, wall canvas, upload helper
  auth/                    sign-in form, account forms
  admin/                   shell, intake chart, icon picker, and one *-forms file
                           per admin page

lib/
  pricing.ts   + test      THE money function: frame + print + glazing
  coupons.ts   + test      validation, caps, new-customer rule
  tax.ts       + test      GST pulled out of an inclusive price
  frame-options.ts + test  shape, thickness availability
  custom-frame.ts  + test  custom size range, in/cm, outer size
  phone.ts     + test      sign-in identifier parsing
  auth.ts                  getCurrentUser / requireUser / requireStaff
  catalog.ts, storefront.ts  read the catalogue and price it
  business.ts              the real-world business details
  artwork.ts   + test      stored artwork -> a CSS `background` SHORTHAND
  frame-catalog.ts         thicknesses and mat bands, read from the database
  artwork-file.ts          signs a customer's private photo for staff
  catalogue-upload.ts      product artwork -> the public `catalogue` bucket
  supabase/admin.ts        service-role client — server actions only, never shared

scripts/                   seed, demo orders, make:admin, staff:password,
                           setup:storage, prune:uploads, links, browser.mjs (CDP)
  supabase/                server and browser clients

db/
  schema.ts                22 tables
  seed-data.ts             all mock data, clearly marked
  migrations/              0000 tables · 0001 user trigger · 0002 RLS
                           0003 PDP fields · 0004 glazing + storage
                           0008 drop preview columns · 0009 staff permissions
                           0010 sizes, thickness, mat rates
supabase/functions/
  send-sms/                Deno — Supabase's Send SMS Hook -> Fast2SMS
```

**Commands**

| | |
|---|---|
| `npm run dev` · `build` · `test` | the usual three |
| `npm run links` | fails on any internal link no route serves |
| `npm run seed` · `demo:orders` · `demo:clear` | catalogue and realistic orders |
| `npm run make:admin -- <email>` | the first super-admin, from the database |
| `npm run staff:password -- <email> [pw] [--reset-mfa]` | set a staff password; the bootstrap |
| `npm run setup:storage` | creates the `studio` (private) and `catalogue` (public) buckets |
| `npm run prune:uploads [-- --apply]` | reclaims photos no cart or order references |
| `npm run prices` · `db:generate` · `db:push` | pricing preview, migrations |

---

## Sprint 0 — Design & money layer ✅

- [x] Read the Figma files, wrote [ARCHITECTURE.md](ARCHITECTURE.md)
- [x] `db/schema.ts`, `lib/pricing.ts`, `lib/tax.ts`, `lib/coupons.ts`, all with tests
- [x] `db/seed-data.ts`, `scripts/price-preview.ts`

The whole money path was verified before a single pixel existed.

---

## Sprint 1 — Foundation ✅

- [x] Next.js 16 + React 19 + TypeScript + Tailwind v4
- [x] Route groups `(shop)` and `(admin)`, `.env.example`, Drizzle config
- [x] `scripts/seed.ts` written (first run against a real database came in S3)

---

## Sprint 2 — Design system + home page ✅

- [x] Tokens read from Figma, 26 icons downloaded, full shell and home page
- [x] Mobile layout, working dark mode, every price computed

Superseded by Sprint 4's migration to the newer PDP palette.

---

## Sprint 3 — Auth ✅

- [x] Supabase connected, schema migrated, seed loaded and verified
- [x] **RLS enabled on every table** — the browser key could otherwise read and write
      orders, payments and addresses
- [x] OTP sign-in (one field, SMS or email), users synced by database trigger
- [x] Middleware session gate; role gate in the admin layout
- [x] Phone OTP delivered through Fast2SMS behind Supabase's Send SMS Hook (D24)
- ~~Staff signed in here too~~ — **superseded by Sprint 12**: staff have their own door,
  password + TOTP, and an OTP session can no longer reach `/admin`
- [x] Account: profile and addresses

Verified: signed-out bounced, customer refused the admin, super-admin let in, anon key
returns `[]` on every table and 401 on insert.

---

## Sprint 4 — Catalog & product page ✅

The PDP turned out to be designed (Figma 3:10064 desktop, 3:10737 mobile) and carried a
**newer design direction** than the home page. Three decisions the client confirmed before
any code was written:

1. **The PDP is canonical.** Its palette, fonts, header and footer replaced Sprint 2's
   everywhere — Inter for body, Plus Jakarta Sans for headings, Playfair only on the home
   hero. Violet `#6c3ce9`, accent `#ffc329`, paper `#fcf9f4`.
2. **The PDP footer's business details are the real ones.** They end up on GST invoices, so
   they live in one place: [lib/business.ts](lib/business.ts).
3. **Printing stays a paid extra.** The design draws "Frame only — no print · save 30%",
   implying a print included by default. The client confirmed the opposite, so the checkbox
   is inverted to "Add my photo, printed and mounted · +₹X" and the price moves up rather
   than down. A deliberate deviation from the drawing.

**Built**

- [x] Design system migrated to the PDP tokens → [app/globals.css](app/globals.css),
      [app/layout.tsx](app/layout.tsx); home, auth and admin swept onto them
- [x] New header and footer → [components/site/header.tsx](components/site/header.tsx),
      [components/site/footer.tsx](components/site/footer.tsx),
      [components/site/top-bars.tsx](components/site/top-bars.tsx),
      [components/site/logo.tsx](components/site/logo.tsx)
- [x] 15 more icons from the PDP frames → `public/figma/pdp-*.svg`
- [x] Schema: product number, description, specs, NEW badge, rating aggregate; `reviews`
      table; thickness and mat on cart and order items; material slug + swatch →
      [db/migrations/0003_pdp_fields.sql](db/migrations/0003_pdp_fields.sql)
- [x] Seed rebuilt on the design's six finishes and six frames, plus 219 real review rows
      so every aggregate is computed → [db/seed-data.ts](db/seed-data.ts),
      [scripts/seed.ts](scripts/seed.ts)
- [x] `lib/frame-options.ts` + 5 tests — shape, and the "1/2 inch only up to 8 × 12" rule →
      [lib/frame-options.ts](lib/frame-options.ts)
- [x] Product page → [app/(shop)/frames/[slug]/page.tsx](app/(shop)/frames/[slug]/page.tsx),
      [components/pdp/configurator.tsx](components/pdp/configurator.tsx),
      [components/pdp/reviews.tsx](components/pdp/reviews.tsx),
      [components/pdp/frame-preview.tsx](components/pdp/frame-preview.tsx),
      [components/pdp/stars.tsx](components/pdp/stars.tsx)
- [x] Listing pages → [app/(shop)/browse/page.tsx](app/(shop)/browse/page.tsx),
      [app/(shop)/sizes/page.tsx](app/(shop)/sizes/page.tsx),
      [components/shop/frame-card.tsx](components/shop/frame-card.tsx),
      [lib/storefront.ts](lib/storefront.ts)
- [x] Basket, prices recomputed on every render →
      [app/(shop)/cart/page.tsx](app/(shop)/cart/page.tsx)
- [x] Add to basket with server-side re-validation →
      [app/actions/cart.ts](app/actions/cart.ts)

**Flow this added:** browse → configure → add to basket → review basket. Steps 2, 3, 4, 7
and 9 of the customer journey.

**Verified** against the running app with a temporary account, since deleted:

| Check | Result |
|---|---|
| add qty 2, then 1 more of the same configuration | one line, qty 3 — not two lines |
| 1/2 inch at 30 × 24 in | refused: *"That frame thickness is not available at this size."* |
| basket total | 3 × ₹154 = ₹462 + ₹79 delivery = ₹541 |
| `/browse`, `/browse?category=`, `/sizes`, `/cart`, `/frames/[slug]` | all 200 |
| product specs order | fixed — `jsonb` reorders object keys, so specs are stored as ordered pairs |

**Deferred from this sprint:** D5 (rating 4.1 vs 4.7), D6 (placeholder artwork),
D8 (`typedRoutes` off), D12 (free-shipping threshold).

---

## Sprint 5 — Custom Studio ✅

Designed after all (Figma 3:1088 desktop, 3:1569 mobile). Built on the PDP's tokens, since
the studio frame was drawn with the older header and footer.

**Built**

- [x] **Glazing** — a priced dimension earlier sprints did not have. Standard 3 mm styrene
      is included; UV acrylic is ₹6.05/sq·in, which reproduces the design's "+₹1,162" on
      192 sq in exactly. `glazing_options` + `glazing_rates`, priced by the same band
      mechanism as paper → [db/migrations/0004_glazing_and_studio.sql](db/migrations/0004_glazing_and_studio.sql),
      [lib/pricing.ts](lib/pricing.ts) + 2 new tests
- [x] `lib/custom-frame.ts` + 8 tests → [lib/custom-frame.ts](lib/custom-frame.ts)
      — the "4 × 4 to 40 × 60 in" rule read as *no side under 4 in, long side ≤ 60, short
      side ≤ 40*; in/cm conversion that survives a round trip; and the outer size
      (12 × 16 in a 1 inch moulding = **13.6 × 17.6 in**, the design's own figure)
- [x] Wall visualiser — drag, scale slider, centre button, arrow-key nudging, five wall
      presets or the customer's own room photo →
      [components/studio/wall-canvas.tsx](components/studio/wall-canvas.tsx)
- [x] Uploads straight from browser to Supabase Storage, private `studio` bucket, policies
      confining each customer to a folder named after their own user id →
      [components/studio/upload.ts](components/studio/upload.ts)
- [x] **DPI guard** — the artwork's real pixel size against the chosen print size, warning
      below 150 DPI before the customer pays
- [x] All five steps — picture size, moulding, thickness, mat border with colour, glazing —
      plus the price breakdown → [components/studio/studio.tsx](components/studio/studio.tsx),
      [app/(shop)/custom/page.tsx](app/(shop)/custom/page.tsx)
- [x] Add to basket, saving the design as its parts plus a placement transform — never a
      rendered composite → [app/actions/custom.ts](app/actions/custom.ts)

**Flow this added:** build from scratch → upload artwork → position on a wall → add to
basket. Steps 5, 6 and 7 of the customer journey.

**Verified** against the running app with a temporary account, since deleted:

| Check | Result |
|---|---|
| upload into own folder | ok |
| upload into another user's folder | **blocked** by the storage policy |
| valid 12 × 16 custom frame | `{ok: true}`, design row + basket line saved |
| 70 × 70 in | refused: *"The longer side can be at most 60 in."* |
| 1/2 inch at 30 × 24 in | refused: *"That frame thickness is not available at this size."* |
| forged upload path under another user id | refused: *"That upload is not yours."* |
| basket line | Custom frame · Natural Oak · 12 × 16 in · 1 inch · Mat · UV acrylic |
| basket total | ₹691.20 frame + ₹1,161.60 glazing = **₹1,852.80** |

**Bug this caught.** The basket re-priced cart lines without their glazing, so an
upgraded-glazing order would have been **undercharged by ₹1,162** at checkout. The cart now
loads glazing rates and passes them to `priceLine`. It surfaced only because the total was
checked against the design's own number.

**Deferred from this sprint:** D1 (UV acrylic price placeholder), D2 (mat free —
settled), D7 (wall not life-size), D11 (studio frame uses the older chrome).

---

## Sprint 6 — Cart, checkout, payment  [~] part done

Everything up to the payment button is finished and verified. The payment half waits on
Razorpay test keys, which the client will provide later.

**Built**

- [x] One basket loader shared by the basket page, checkout and order creation, so the
      three can never disagree about a price → [lib/basket.ts](lib/basket.ts)
- [x] Quantity stepper and removal → [app/actions/cart.ts](app/actions/cart.ts),
      [components/checkout/basket-lines.tsx](components/checkout/basket-lines.tsx)
- [x] Coupon entry, apply and remove, showing the rejection sentences from
      `lib/coupons.ts` → [components/checkout/coupon-form.tsx](components/checkout/coupon-form.tsx).
      Only the **code** is stored on the cart; the discount is recomputed on every render,
      so a coupon that expires while the basket sits there stops applying
- [x] `carts.coupon_code` → [db/migrations/0005_cart_coupon.sql](db/migrations/0005_cart_coupon.sql)
- [x] Checkout: address selection reusing `addresses`, read-only line review, final summary
      → [app/(shop)/checkout/page.tsx](app/(shop)/checkout/page.tsx),
      [components/checkout/summary.tsx](components/checkout/summary.tsx)
- [x] **`buildOrderDraft`** — the price-freezing logic, pure and testable without a
      database: re-checks the coupon, decides shipping, splits the GST, and snapshots
      every line with its material and paper names as text →
      [lib/orders.ts](lib/orders.ts) + **10 tests**
- [x] Order numbers that avoid characters misread aloud (`FZ-26K4P9-7R2M`)
- [x] `/checkout` added to the signed-in-only routes in [middleware.ts](middleware.ts)
- [x] [scripts/browser.mjs](scripts/browser.mjs) — a dependency-free CDP driver, so forms
      and server actions are verified by real clicks rather than hand-encoded requests

**Flow this added:** basket → coupon → checkout → address → summary. Steps 9 and part of
10 of the customer journey.

**A rule worth knowing:** free shipping is measured **after** the discount. ₹1,536 of goods
clears the ₹1,499 threshold on its own, but a 10% coupon drops it to ₹1,382.40 and delivery
comes back. Tested both ways.

**Verified** in a real browser, with a temporary account since deleted:

| Check | Result |
|---|---|
| basket totals | ₹691.20 + ₹79 delivery = ₹770.20 |
| apply `frame10` (lower case) | normalised, FRAME10 applied, −₹69.12 |
| total with coupon | ₹701.08 |
| free-delivery hint | "Add ₹876.92 more" = ₹1,499 − (₹691.20 − ₹69.12) |
| remove coupon | back to ₹770.20 |
| quantity +1 | qty 2, line ₹1,382.40, total ₹1,323.16 |
| quantity −1 | back to ₹701.08 |
| checkout | address shown, coupon carried, total ₹701.08, quantities locked |
| pay button | disabled, with the reason stated on the page |

**Left for when the keys arrive**

- [ ] Razorpay order creation
- [ ] **Webhook as the source of truth** — the order row is created only on confirmed payment
- [ ] `createOrderFromCart` — writes the draft into `orders` + `order_items`, records the
      coupon redemption, empties the basket
- [ ] Order confirmation page

**[!] Blocker: Razorpay test keys** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, already stubbed in `.env`.

---

## Sprint 7 — Fulfilment & tracking

- [ ] Shiprocket auth with token refresh on 401 (the usual failure point)
- [ ] "Ready to ship" → shipment and AWB in one click
- [ ] Tracking webhook → `shipped`, `delivered`
- [ ] Customer order list and tracking — designed (3:6563 desktop, 3:6281 mobile)
- [ ] Print-file render on demand with `sharp`, from the stored artwork and transform
- [ ] "Ready to ship" in the admin also creates the shipment — the button already exists and
      says so

**[!] Blocked on you:** Shiprocket credentials.

---

## Sprint 8 — Admin ✅

Figma hit its Starter-plan call limit before the admin frames could be read, so these are
built on the established design system rather than pixel-matched. Logged as D18.

**Unblocked first.** Orders had nothing to show, because order creation was parked with the
Razorpay work. But only the *webhook trigger* needs Razorpay — the writing does not. So
`createOrderFromCart` was built and verified now, and the webhook will simply call it.

**Built**

- [x] `createOrderFromCart` — one transaction: order, items with frozen breakdowns, coupon
      redemption, and the basket emptied. An order with no items, or a coupon marked used
      against an order that was never written, would both be worse than a failed checkout
      → [lib/order-create.ts](lib/order-create.ts)
- [x] `lib/order-status.ts` + **7 tests** — the lifecycle as a state machine. A paid order
      cannot jump to delivered; a shipped order can no longer be cancelled
- [x] Admin shell with role-aware nav → [components/admin/shell.tsx](components/admin/shell.tsx)
- [x] Dashboard — revenue, orders, average, *needs action*, status counts, recent orders
      → [app/(admin)/admin/page.tsx](app/(admin)/admin/page.tsx)
- [x] Orders list with status filters → [app/(admin)/admin/orders/page.tsx](app/(admin)/admin/orders/page.tsx)
- [x] Order detail — **"What to make"**: size, moulding, thickness, mat, glazing and print
      per line, the delivery address, and the frozen money
      → [app/(admin)/admin/orders/[id]/page.tsx](app/(admin)/admin/orders/[id]/page.tsx)
- [x] Products & Frames, Categories, with live/hidden toggles
      → [app/(admin)/admin/products/page.tsx](app/(admin)/admin/products/page.tsx),
      [app/(admin)/admin/categories/page.tsx](app/(admin)/admin/categories/page.tsx)
- [x] `npm run demo:orders` / `npm run demo:clear` — realistic orders through the real
      creation path, so the admin shows frozen orders rather than fixtures
      → [scripts/demo-orders.ts](scripts/demo-orders.ts)
- [x] `npm run make:admin -- you@example.com` — the first admin has to be made by someone
      with database access, by design → [scripts/make-admin.ts](scripts/make-admin.ts)

**Flow this added:** staff sign in → dashboard → orders → open one → advance its status.
Steps 2 and 3 of the staff journey.

**Verified** against the running app:

| Check | Result |
|---|---|
| 5 demo orders created through `createOrderFromCart` | totals reconcile; all 7 items carry a frozen breakdown |
| `FRAME5` on a ₹130.90 basket | **refused** — below its ₹200 minimum |
| `FRAME5` on a ₹2,122.20 basket | applied, −₹106.11, redemption recorded |
| baskets after ordering | emptied |
| paid order in the admin | offers *Mark ready to ship*, *Cancel order* |
| clicking it | becomes ready to ship, then offers *Mark shipped* |
| shipped order | offers only *Mark delivered* — no cancel |
| forged POST: delivered → paid | **refused**, order unchanged |
| super_admin / admin on all 5 admin routes | 200 |
| customer on all 5 admin routes | 307 → `/` |

**A measurement mistake worth recording.** A first pass at the role test showed customers
redirected to `/sign-in`, which looked like the role gate working. It was not — the session
had expired, so the test proved nothing. Re-run with a fresh session it showed 307 → `/`,
which is the role gate. A green result from a dead session is worse than a red one.

**Deferred from this sprint:** D17 (`orders.placed_at` column naming), D18 (admin not
pixel-matched to Figma), D19 (print-file download needs the service-role key).

---

## Sprint 9 — Super admin ✅

Super-admin-only screens. `requireSuperAdmin` already exists from Sprint 3; these are the
first pages to use it.

- [x] Super-admin gate on the routes, and the nav showing them →
      [components/admin/shell.tsx](components/admin/shell.tsx). Verified across all three
      roles: `super_admin` 200 · `admin` 307 → `/admin` · `customer` 307 → `/`
- [x] **Price & Material Control** → [app/(admin)/admin/pricing/page.tsx](app/(admin)/admin/pricing/page.tsx),
      [components/admin/rate-card.tsx](components/admin/rate-card.tsx),
      [components/admin/settings-form.tsx](components/admin/settings-form.tsx),
      [app/actions/pricing-admin.ts](app/actions/pricing-admin.ts)
    - Rate bands for every moulding, paper and glazing: add, edit, remove
    - **Live price preview beside each rate card** — type a size, see what that rate
      actually charges, before saving
    - Delivery, free-delivery threshold, seller state, GSTIN, GST and COD toggles
    - `lib/rate-input.ts` + **10 tests** guarding what feeds the pricing engine
    - The last rate band of a moulding cannot be removed, because a moulding with no
      bands cannot be priced at all and would vanish from the shop unexplained
    - GST cannot be switched on without a valid GSTIN — a blank number on every invoice

      **Verified end to end in a browser:** changed UV acrylic from ₹6.05 to ₹7.00/sq·in in
      the admin, and the Custom Studio immediately quoted **+₹1,344** on 192 sq·in instead
      of +₹1,162. Rate then restored to ₹6.05. Guards: `0` → *"zero would make every frame
      free"*, `-5` → *"cannot be negative"*, `abc` → *"not a number"*, `999999` → *"looks
      like a typo"*; the stored rate was unchanged in all four cases.
- [x] **Coupons** → [app/(admin)/admin/coupons/page.tsx](app/(admin)/admin/coupons/page.tsx),
      [components/admin/coupon-form.tsx](components/admin/coupon-form.tsx),
      [app/actions/coupon-admin.ts](app/actions/coupon-admin.ts)
    - Create and edit: code, percent or flat, minimum order, discount cap, first-order-only,
      usage limit, end date, active
    - Each row shows **times redeemed** and **how much has been given away**, read from
      real orders

      **Verified in a browser:** `MONSOON20` 20% over ₹1,000 capped at ₹500 → created;
      duplicate `FRAME5` → *"already exists"*; `"a b"` → *"letters and digits, no spaces —
      customers have to type it"*; 95% off → *"almost certainly a typo"*. Test coupons
      removed afterwards.
- [x] **Revenue & Analytics** → [app/(admin)/admin/revenue/page.tsx](app/(admin)/admin/revenue/page.tsx)
    - Collected, orders, average, and the GST sitting inside the total
    - By month, by ship-to state (marking which ones are CGST+SGST), by moulding, best sellers
    - A money breakdown: goods − coupons + delivery = collected
    - Cancelled and refunded orders are excluded throughout — money that never arrived

      **Verified against the database:** goods ₹4,267.66 − coupons ₹106.11 + delivery
      ₹237.00 = collected ₹4,398.55, and the page prints the same four figures. GST shows
      ₹0.00 because `gst_enabled` is still off, which is correct.
- [x] **Staff & Permissions** → [app/(admin)/admin/staff/page.tsx](app/(admin)/admin/staff/page.tsx),
      [components/admin/staff-forms.tsx](components/admin/staff-forms.tsx),
      [app/actions/staff-admin.ts](app/actions/staff-admin.ts)
    - Staff list with role control, recent customers, grant-by-email, and a matrix of what
      each role can reach
    - **You cannot change your own role** — demoting yourself by accident locks you out
    - **The last super-admin cannot be demoted** — nobody could grant the role back
      without database access
    - Someone must sign in once before they can be made staff; there is no way to create
      an account on their behalf

      **Verified in a browser:** own row renders with no control at all, captioned *"you
      cannot change your own role"*; promoting and demoting another account works; a
      profile row with no account behind it neither masks the last super-admin nor becomes
      undemotable.

      **Honest limit:** the last-super-admin branch is a safety net that the own-role rule
      makes unreachable in practice — a live super-admin always counts themselves, so the
      count can never be 1 when the target is a different live super-admin. The own-role
      lock is what actually prevents lockout, and that is the part exercised.

**Flow this added:** super-admin sets a rate → the whole shop reprices → orders already
placed keep their frozen figures. Step 6 of the staff journey.

Resolved **D1** — the UV acrylic price is no longer a placeholder in the code; it is a
number the super-admin sets, and the change was watched reaching the Custom Studio.

**A security hole found and closed mid-sprint.** `public.users` had no cascade from
`auth.users`, so a deleted account left its profile row behind holding whatever role it had.
A ghost `super_admin` row also defeated the "last super-admin" guard by making it look as
though there were two. A blanket foreign key was tried first and rejected — demo customers
deliberately have no auth row — so migration
[0006_users_cascade.sql](db/migrations/0006_users_cascade.sql) removes ghost rows that hold a
**staff** role, and the guard now counts auth-backed super-admins.

**And a flaw in that fix, found by testing it.** The first version refused to demote a ghost
super-admin, because it counted live super-admins without asking whether the *target* was
live. A ghost should always be removable. Fixed, then re-tested.

**Deferred from this sprint:** D20.

---

## Sprint 10 — Design alignment & the remaining screens ✅

Client supplied screenshots for every remaining screen. Figma MCP is still rate-limited on
the Starter plan (D15/D18), so these are built from the screenshots against the established
tokens rather than read node-by-node.

- [x] Schema: `wishlist_items` (a whole saved configuration, unique per config so saving
      twice is a no-op), `users.preferences`, `addresses.label` →
      [db/migrations/0007_wishlist_prefs.sql](db/migrations/0007_wishlist_prefs.sql).
      RLS enabled on the new table. `lib/preferences.ts` + 4 tests — order updates can
      never be switched off, because that is how someone learns their frame shipped
- [x] **Basket** on its design → [app/(shop)/cart/page.tsx](app/(shop)/cart/page.tsx)
      — breadcrumb with *Continue shopping*, frame count and free-delivery note, order
      summary with Subtotal / Discount / Delivery / Total *inclusive of GST*, coupon field
      with suggested codes, the *Something missing?* custom-frame card, and the sticky
      total bar on phones
- [x] **Sign In** on its design → [app/(auth)/sign-in/page.tsx](app/(auth)/sign-in/page.tsx),
      [components/auth/auth-shell.tsx](components/auth/auth-shell.tsx) — guest avatar and
      *"You're browsing as a guest"*, Sign in / Create account tabs, *Continue as guest*,
      and the three reasons to sign in
- [x] **Sign Up** as its own screen → [app/(auth)/sign-up/page.tsx](app/(auth)/sign-up/page.tsx)
      — *New artisan member*, a full-name field, and the member-privileges panel. The name
      rides along in the OTP signup metadata, so the `auth.users` trigger copies it into
      `public.users` and there is no separate "save your name" step
- [x] **Account** split into four screens, with a shared sidebar carrying live counts →
      [components/account/shell.tsx](components/account/shell.tsx)
    - Profile → [app/(shop)/account/page.tsx](app/(shop)/account/page.tsx) — name, email,
      phone with a verified marker
    - Orders & tracking → [app/(shop)/account/orders/page.tsx](app/(shop)/account/orders/page.tsx)
      — the five-stage timeline from the design, per-order items and totals
    - Addresses → [app/(shop)/account/addresses/page.tsx](app/(shop)/account/addresses/page.tsx)
      — nicknames (Home, Studio), default marking, add and remove
    - Preferences → [app/(shop)/account/preferences/page.tsx](app/(shop)/account/preferences/page.tsx)
      — the four toggles, with order updates locked on

      **`lib/tracking.ts` + 7 tests.** The design draws five stages but the order model has
      four, because the client declined a separate production step in Sprint 0. Rather than
      invent a status, the four real ones map onto the drawn labels and *"Out for delivery"*
      is never marked reached — nothing reports it until Shiprocket webhooks land in
      Sprint 7. Tested explicitly: no status ever marks it done. Conflict **C1**.

      **Verified signed in:** all four screens 200; the timeline renders *Order placed → In
      the workshop → Dispatched → Out for delivery → Delivered* with a `ready_to_ship` order
      sitting at *In the workshop*; addresses show the Home nickname and default marker;
      preferences show all four toggles with order updates captioned *"Always on"*.
- [x] **Wishlist** → [app/(shop)/wishlist/page.tsx](app/(shop)/wishlist/page.tsx),
      [app/actions/wishlist.ts](app/actions/wishlist.ts)
    - A saved item is a whole configuration — size, moulding, thickness, mat, glazing —
      because that is what a customer comes back for, and what moves to the basket in one
      click
    - Move one, move all, remove, clear all, per-item *Customise*, and the custom-frame
      prompt from the design
    - Prices are computed live, so a saved frame reprices if a rate changes

      **Verified in a browser:** 3 saved, a duplicate configuration ignored by the unique
      index, unit prices ₹489.60 + ₹528.00 + ₹622.08 = ₹1,639.68 matching the footer total;
      *Move to basket* took wishlist 3 → 2 and basket 0 → 1; *Move all* took it to 0 and 3.
- [x] **Help Centre** → [app/(shop)/help/page.tsx](app/(shop)/help/page.tsx),
      [components/help/size-chart.tsx](components/help/size-chart.tsx)
    - Sizing / Delivery / Returns cards, a six-question FAQ, and the contact strip
    - **Compare frame sizes** — every box drawn to scale from the real dimensions in the
      `sizes` table, with its computed "from" price, switchable between horizontal,
      vertical and square
    - The FAQ reads the live delivery threshold from settings, so it cannot go stale:
      it currently prints *"free on orders over ₹1,499.00"* because that is what the
      super-admin has set
- [x] **Shop / browse** rebuilt against `framezee_shop_desktop` →
      [app/(shop)/browse/page.tsx](app/(shop)/browse/page.tsx),
      [components/shop/filter-sidebar.tsx](components/shop/filter-sidebar.tsx),
      [components/shop/shop-card.tsx](components/shop/shop-card.tsx)
    - Filter sidebar: category, material, size, finish swatches, price bands, each with
      counts taken from the **unfiltered** set so a facet never reads zero just because
      something else is selected
    - Sort by Latest / Price ↑ / Price ↓ / A–Z
    - Cards with NEW badge, save-to-wishlist, category + availability, title + price,
      the `Wood · 7 × 5 in` spec line and *Add to basket*
    - *Not sure of the size?* and the made-to-measure card from the design
    - **Filters live in the URL, not component state**, so a filtered view can be shared
      and the page stays server-rendered → [lib/shop-filters.ts](lib/shop-filters.ts)
      + **12 tests**

      **Verified against the running app:** no filter 6 of 6 · `category=nature` 2 ·
      `kind=metal` 1 · `finish=maple` 1 · `max=₹150` 4 · `category=nature&kind=metal`
      **0** (filters narrow, they do not widen) · a junk size 0. Price ascending runs
      ₹94 → ₹111 → ₹133 → ₹150 → ₹166 → ₹270; A–Z and Latest order correctly.

- [x] **Product details** realigned to `framezee_product_details_desktop` →
      [components/pdp/configurator.tsx](components/pdp/configurator.tsx),
      [components/studio/wall-stage.tsx](components/studio/wall-stage.tsx)
    - The left column is now the **wall visualiser** the design shows — drag to position,
      scale, rotate, centre, upload a room photo or pick a wall colour — not the static
      preview Sprint 4 shipped with a "Sprint 5" note
    - The visualiser and the Custom Studio now share **one** `WallStage`, so the two
      cannot drift apart. `Transform` gained rotation
    - The frame on the wall shows the product's own artwork, and the title, rating and
      description moved into the right column beside it, as drawn
    - Because the stage shares the configurator's state, changing finish, size, thickness
      or mat updates the frame on the wall immediately

- [x] **Custom Studio** realigned to `framezee_custom_frame_studio_desktop` →
      [components/studio/studio.tsx](components/studio/studio.tsx)
    - Now uses the same `WallStage` as the product page, so its wall, sliders, presets and
      upload are one implementation rather than two
    - Gained **rotate** alongside scale, as the design shows
    - The frame renders far larger and to proportion — a 12 × 16 in reads as a 12 × 16 in

      **A regression this extraction caused, caught by testing it.** Moving the canvas into
      the shared component left `setTransform` in the Studio wired to nothing, so every
      design would have saved as *centred* no matter where the customer dragged it — the
      placement silently lost. `WallStage` now reports the placement up. Verified with
      trusted pointer input: dragged to 75% / 28% and rotated 8°, and the saved
      `custom_designs.transform` read back `{x: 75, y: 28, rotation: 0}` and `{rotation: 8}`.

      Also hardened: `setPointerCapture` is now wrapped, because it throws for a pointer id
      the browser does not recognise and would take the whole drag handler down with it.

- [x] **The wall preview is a preview, and nothing more** — client correction, acted on
    - The workshop needs the **photo that goes inside the frame**. Where a simulated frame
      sat on a simulated wall, and how far it was rotated, are not production inputs
    - The wall photo **is no longer uploaded**. It stays in the browser as an object URL,
      so a customer's room photograph never reaches our server or storage
    - `custom_designs.room_image_path`, `.transform`, `.wall_preset` and
      `order_items.transform` dropped →
      [db/migrations/0008_drop_preview_columns.sql](db/migrations/0008_drop_preview_columns.sql).
      Dead columns are worse than absent ones — someone eventually reads them and believes
      they mean something
    - Drag, scale and rotate remain, purely as a way to picture the frame in a room

      **Verified:** dragged the frame to 80% and added to basket — the saved design holds
      only size, moulding, thickness, mat, mat colour, glazing and the print image, and
      **0 files** were uploaded because the wall photo never left the browser.

- [x] **The nine remaining pages checked against their `code.html`**, not against my
      memory of a screenshot. Most matched; three had real gaps, now closed:
    - **Wishlist** — sort by Recently Added / Price low-high / high-low, *Share list*, and
      a proper empty state → [app/(shop)/wishlist/page.tsx](app/(shop)/wishlist/page.tsx),
      [components/shop/share-list.tsx](components/shop/share-list.tsx)
    - **Help Centre** — the desktop design stacks *Horizontal / Vertical / Square* groups
      with headings rather than switching between them, at one shared scale so a square
      12 in reads the same size as a 12 × 8 in. Phones keep the switcher, and *Hide size
      chart* works → [components/help/size-chart.tsx](components/help/size-chart.tsx)
    - **Orders & tracking** — *Hide tracking*, *View items* and **Order again**, the first
      two as `<details>` so they need no JavaScript →
      [app/(shop)/account/orders/page.tsx](app/(shop)/account/orders/page.tsx)

      *Order again* re-prices from today's rate cards rather than reusing the frozen
      figures: the old order keeps what it was charged, the new basket charges what the
      frame costs now. A moulding that has since been retired is skipped rather than
      resurrected.

      **Verified:** basket 0 → 1 line / 1 unit matching the order, total ₹263.80. Help
      centre renders all three size groups. Wishlist shows Sort by, Share list, Clear all
      and Move all to basket.

    Basket, sign-in, sign-up, profile, addresses and preferences already matched their
    markup — allowing for the features the client removed (social login, welcome credit,
    referral code).

### The design folder — a better source than Figma

The client supplied `/home/suman/Downloads/Framezee-design`: **44 page folders**, each with
a `screen.png` and a full `code.html`, plus two `DESIGN.md` system specs — *Warm Gallery
E-Commerce* (storefront) and *Operations Cockpit* (admin). This replaces Figma as the
reference and is not rate-limited.

**The design system checks out against what was built:**

| Spec | In the app |
|---|---|
| `primary` `#5314d1`, `primary-container` `#6c3ce9` | `--violet-deep`, `--violet` ✓ |
| `secondary-container` `#ffc329`, `on-secondary-container` `#6f5100` | `--accent`, `--accent-ink` ✓ |
| `surface` `#fcf9f4`, `surface-container-low` `#f6f3ee`, `on-surface` `#1c1c19` | `--page`, `--subtle`, `--ink` ✓ |
| Headings Plus Jakarta Sans, **body Inter**, labels Inter | ✓ as built |

So the divergence the client saw is **composition, not tokens**.

**A real bug it exposed.** Sprint 4 renamed the catalogue to frame names
(`natural-oak-001` …) but `components/home/product-card.tsx` kept its own artwork map keyed
to the *old* slugs. Every New Arrivals card fell through to a grey placeholder with the
title repeated inside it — while `/browse`, which used a different card, looked correct.
Two card components, one stale. Now there is **one**:
[components/shop/frame-card.tsx](components/shop/frame-card.tsx), carrying the design's
name-left / price-right arrangement and a price range. `lib/catalog.ts` was folded into
[lib/storefront.ts](lib/storefront.ts) so there is also one catalogue loader.

**Hero staging** now has mats and captions (*Family Portrait*, *Wedding memories*,
*Landscape Mist*, *Postcard*) rather than empty frames.

### Client direction on the designs

> "the design i share with you not 100% truth … some text and features you can mold as our
> requirement not 100 same as design … UI also AI generated"

So the designs are a guide to intent, not a spec to copy. Text and features are shaped to
the real requirement; composition and polish follow the design.

**Flow this added:** sign up → save frames to a wishlist → move them to the basket →
check out → track the order → manage profile, addresses and preferences. Steps 1, 8, 12 and
13 of the customer journey, plus a new wishlist step.

### Conflicts spotted in the new screens

Recorded rather than decided, per the working rules. None blocks building; each is a
question for the client.

| # | What the design shows | What exists | Why it matters |
|---|---|---|---|
| C1 | Tracking with five stages: *Order placed → In the workshop → Dispatched → Out for delivery → Delivered* | Four: `paid → ready_to_ship → shipped → delivered` | "In the workshop" is the production step the client explicitly declined in Sprint 0. "Out for delivery" would come from a Shiprocket webhook |
| ~~C2~~ | ~~Google and Apple sign-in~~ | — | **Closed** — client: design only, OTP is the whole story. Nothing was built |
| ~~C3~~ | ~~Password login~~ | — | **Closed** — client: design only |
| ~~C4~~ | ~~₹100 Welcome Credit~~ | — | **Closed** — client: design only, removed |
| ~~C5~~ | ~~Referral / invite code~~ | — | **Closed** — client: design only, removed |
| ~~C6~~ | ~~Order number format~~ | `FZ-26K4P9-7R2M` | **Closed** — client: the current format is fine |
| C7 | "Continue as guest" on sign-in | Login required to buy | Browsing as a guest already works; buying does not |
| C8 | A GSTIN in the footer | `19AAAAA0000A1Z5` set as a placeholder | Client: use a placeholder for now. **Must be swapped for the real GSTIN before launch** — Sprint 11 |
| C9 | Header nav differs again across screens (*Custom Framing · Mouldings & Mats · Size Guide · Help Centre*) | PDP nav, chosen as canonical in Sprint 4 | Building to the canonical one |

---

## Sprint 12 — Admin rebuild, catalogue control & storefront polish ✅

*Filed before Sprint 11 deliberately: Launch is still the last thing that happens, whatever
number it carries.*

Not planned. It came out of the client walking the dashboard page by page and finding that
almost every screen could *show* but not *do*.

### Staff authentication rebuilt

- [x] Staff sign-in moved to **`/framezee/a/auth/admin`** — email + password, then a TOTP
      code. Not linked from anywhere, `noindex`
- [x] Customer auth **unchanged** — still phone or email OTP at `/sign-in`
- [x] `requireStaff()` demands **aal2**, so a staff member cannot reach the dashboard
      through the customer OTP form without their authenticator. The secret path is not
      the control; this is
- [x] An account with no authenticator enrols one during first sign-in — no window in
      which a staff account exists without a second factor
- [x] `npm run staff:password` — the bootstrap, because the first password cannot come
      from inside an app that requires a password
- [x] Migration `0009` — `permission` (read | read_write), `suspended_at`, `granted_by`
- [x] Staff page: **create an admin** (name, email, phone, permission), change permission,
      promote, **suspend** (keeps the role), **revoke** (back to customer, orders intact)
- [x] The last super-admin who can sign in cannot be revoked, demoted **or** suspended

### Every admin screen made actionable

| Page | Was | Now |
|---|---|---|
| Dashboard | plain table | dark rail, top bar, six metrics, hand-written SVG intake chart, workshop backlog |
| Orders | list only | search, per-row status moves, photo-to-print flag, **download the customer's file** |
| Products | Live toggle | add, edit, delete, inline category move, artwork **upload** |
| Categories | Shown toggle | add, rename, reorder, delete, emoji picker |
| Price & Material | rates only | add/edit/delete mouldings, glazing, papers + **sizes, thickness, mat board** |

- [x] Guards everywhere a delete would corrupt something: a category holding frames, a
      frame that has sold, a moulding a product defaults to, the included glazing
- [x] `permission` enforced in `app/actions/admin.ts` via `requireWrite()`

### Options that were hardcoded are now data

- [x] Migration `0010` — `frame_thicknesses` and `mat_rates`
- [x] Thickness was two constants plus a hardcoded 12 × 8 rule in `lib/frame-options.ts`.
      Now rows with per-thickness limits; the sentence under the chips is generated
- [x] **The mat board is free because its rate card is empty**, the same rule that makes
      the included glazing free. Adding one band starts charging shop-wide, no deploy.
      Verified on the real database: 0 bands → ₹0, one band → ₹288 on a 12 × 16 in
- [x] The ready-made size list is editable — it had no admin page at all

### The print service actually collects a photograph

- [x] **The bug:** ticking "Add my photo, printed and mounted" charged for printing and
      never asked for a file. The upload only existed in the Custom Studio
- [x] The product page now asks **which** photo — ours or yours — and refuses to add to
      basket without one when you choose your own. DPI shown before paying
- [x] Photos are **compressed in the browser** before upload: 4,500 px long edge, quality
      0.9. Falls back to the original if the browser cannot decode it
- [x] `npm run prune:uploads` reclaims files no cart or order references, after 30 days
- [x] Staff download via a signed URL — closes **D19**. Verified: signed 200, public 400

### Storefront

- [x] Hero rebuilt — headline clear of the photographs, Playfair Display, four real frames
      stepping forward in turn on one shared keyframe
- [x] Hero images 14 MB → 641 KB WebP; `section-1.png` 7.6 MB → 146 KB
- [x] `.glass` / `.glass-dim` defined once, used by all three panes
- [x] Gallery-wall strip drifts left to right, seamless, no JavaScript
- [x] **`npm run links`** — walks every literal href and fails on any route that does not
      exist. Written after three families of dead links shipped

### Configuration

- [x] **`lib/env.ts`** — every environment-dependent value read and validated in one
      place. Scattered `process.env` reads are how a hardcoded `localhost:3000` reaches
      production: nothing fails, the link just points at the wrong machine
- [x] `NEXT_PUBLIC_APP_ENV` — development | staging | production
- [x] `NEXT_PUBLIC_SITE_URL` — defaults to localhost in development, and **production
      refuses to start** without it, or with a non-https one
- [x] `metadataBase` set from it, so social previews resolve against the real domain
- [x] `ADMIN_SIGN_IN` moved into `lib/env.ts`: importing `lib/auth.ts` from a plain node
      script drags in `next/navigation` and fails. Middleware and the script now share
      the one definition instead of keeping copies
- [x] Social handles moved into `lib/business.ts` — public, not per-environment
- [x] `.env.example` refreshed: it was missing `FAST2SMS_API_KEY` entirely

Verified: `dev` and `prod` behaviour exercised across six cases, and no server-side secret
appears in the rendered HTML.

### Bugs found and fixed along the way

| What | Why it was invisible |
|---|---|
| `backgroundImage` given a `background` shorthand | Dropped silently — uploaded artwork rendered as an empty frame, gradients still worked |
| Minifier deduped `backdrop-filter` to `-webkit-` only | Panes rendered with **no blur**; a 55 %-white panel looks similar either way |
| Next's 1 MB server-action body cap | Any photo over 1 MB failed with an opaque 500 |
| `/art-prints`, `/sizes/{w}x{h}`, `/browse/{slug}` | Links written ahead of routes; nothing checked them |
| Stale server after `.env` changed | `process.env` is read once at boot — the staff page kept saying the key was missing |

**Verified at the end:** 117 tests, typecheck clean, links clean, build clean, storefront
and admin routes all responding.

---

## Sprint 11 — Launch

- [ ] GST invoice PDF — CGST/SGST vs IGST, HSN per line
- [ ] Turn `gst_enabled` on, enter the real GSTIN
- [ ] Replace every mock rate with a real one
- [ ] COD once Razorpay has settled
- [ ] Order emails / SMS
- [ ] Error tracking, backups, legal pages
- [ ] A real order, end to end

---

## Deferred register

Noticed during a sprint, deliberately not fixed then. Reviewed once all sprints are done.

| # | Item | Raised | Why it waited |
|---|---|---|---|
| ~~D1~~ | ~~UV acrylic price is a placeholder~~ | S5 | **Resolved S9** — editable in Price & Material Control, verified reaching the shop |
| D2 | **A mat board is free.** Client confirmed, and the design's own breakdown says "Mat board, 10 mm … None" | S5 | Settled, not a gap — revisit only if a mat ever costs money |
| D3 | GST rates and HSN codes in `seed-data.ts` are unverified guesses | S0 | Needs the client's CA |
| D4 | All rate cards are mock numbers reverse-engineered from the mockup | S0 | Real rates arrive before launch |
| D5 | Product rating shows 4.1, the design shows 4.7 | S4 | The design's own histogram averages to 4.1 — its two numbers disagree |
| D6 | Hero scene and product artwork are coded placeholders | S2, S4 | Needs real photography |
| D7 | The wall visualiser is illustrative, not life-size | S5 | True scale makes small frames specks |
| D8 | `typedRoutes` switched off in `next.config.ts` | S4 | Turn back on once every route exists |
| D9 | `SUPABASE_SERVICE_ROLE_KEY` is still empty in `.env` | S3 | **Now a blocker.** Staff sign-in is password + TOTP, so the first super-admin needs a password set from the database (`npm run staff:password`), and creating admins uses `auth.admin.createUser`. Neither runs without the key. Also needed for D19 |
| D10 | `DATABASE_URL` used the IPv6-only direct host | S3 | **Hit on the first Vercel deploy — every page 500.** Supabase direct hosts are IPv6-only; Vercel has no IPv6 egress. Fix is the **Transaction pooler on 6543** (`db/index.ts` already sets `prepare:false`, and now `max:1` for serverless). Warning written into `.env.example` |
| D11 | Custom Studio and Shop Figma frames use the **older** header and footer | S5 | Client chose the PDP style as canonical, so these will not pixel-match |
| D12 | Free-shipping threshold is ₹1,499; the PDP implies ~₹400 | S4 | Mock setting, client's call |
| D13 | No per-user coupon usage limit | S0 | Only the global limit and the new-customer rule |
| D14 | Mobile bottom tab bar came from the older home design | S2 | Check against the newer screens in Sprint 10 |
| D15 | Figma MCP hit the Starter-plan call limit mid-sprint | S6 | Blocked reading the basket design; moved that work to Sprint 10 |
| D16 | Checkout address selection reuses "make default" rather than a per-order choice | S6 | Enough for one shipping address; revisit if customers ship to several |
| D17 | `orders.placedAt` maps to a column named `created_at` | S8 | Drizzle maps it correctly; a rename is cosmetic and needs a migration |
| D18 | Admin screens are not matched to the design | S8 | **Dashboard + shell rebuilt 20 Sep 2026** from `framezee_super_admin_dashboard_desktop`: dark fixed rail, top bar, six metric cards beside an SVG intake chart, workshop backlog table. **Still unmatched: Orders, Products & Frames, Categories, Revenue & Analytics, Staff & Permissions, Coupons, Price & Material Control** — each has a design folder |
| D19 | ~~Admin cannot download a customer's artwork~~ | S8 | **Fixed.** `lib/artwork-file.ts` signs the private `studio` object with the service-role key; the order detail page shows a thumbnail and a Download button. Verified: staff signed URL 200, unsigned public URL 400 |
| D20 | Demo customers exist only in `public.users`, with no `auth.users` row | S9 | Deliberate, so nobody can sign in as them — but it rules out a blanket FK onto `auth.users`. Revisit if demo data is ever dropped |
| D21 | **Supabase email template still sends a magic link, not a code.** The app calls `signInWithOtp` and asks for a 6-digit token, but the Magic Link template uses `{{ .ConfirmationURL }}`, so the inbox gets a link | S3 | Dashboard fix: Authentication → Emails → Magic Link, use `{{ .Token }}`. **Blocker for email sign-in** |
| D22 | ~~No `/auth/callback` route, so a magic link cannot establish a session~~ | S3 | **Fixed.** `middleware.ts` now exchanges `?code=` wherever it lands, so the default Supabase link works with no redirect URL to allow-list |
| D23 | Supabase's built-in SMTP caps at ~2 emails/hour and only to project members | S3 | **Do this first.** An SMTP provider (Resend/Brevo/SES) plus D21's `{{ .Token }}` template needs no paperwork and unblocks real sign-in today, while phone OTP waits on GST (D24) |
| D24 | ~~Phone OTP has no provider~~ | S3 | **Done 20 Sep 2026.** `supabase/functions/send-sms/index.ts` delivers Supabase's OTP through Fast2SMS Quick SMS (`route=q`), deployed with `--no-verify-jwt`, signature-verified, wired to `hook_send_sms_uri`. Verified end to end: `/auth/v1/otp` → 200, wallet ₹145 → ₹140, SMS received. `sms_otp_exp` raised 60s → 600s, since 60 seconds is not enough to read an SMS. **₹5/SMS is a development price** — see D27 for the two cheaper routes |
| D25 | `/privacy`, `/terms` and `/dispatch` are linked in the footer but 404 | S10 | Razorpay requires all three live before merchant approval — needs the client's real policy text |
| D26 | "Art Prints & Posters" removed from nav and footer | S10 | Design artefact: we manufacture frames, we do not sell posters. Re-add only if poster stock is ever carried |
| D27 | Phone OTP costs ₹5/SMS on Fast2SMS Quick SMS | S3 | Only route needing neither DLT nor website verification. After deploy, apply for **website verification** → `route=otp` at ₹0.35. After the GSTIN, do **DLT** → `route=dlt` at ₹0.11 with a branded sender. Both are a parameter change in the same Edge Function |
| D28 | Phone sign-in creates a **separate** account from email sign-in | S3 | `918250288412` is its own customer row; `suman@sandboxsecurity.ai` holds super_admin. Supabase has no identity linking for phone+email OTP. Fine as-is — the phone account doubles as a real customer test account. `make:admin` looks up by email only, so promoting a phone account needs a tweak |
| D29 | Fast2SMS API key and the Supabase personal access token were pasted in plain text | S3 | Key is in `.env` (gitignored); the access token was used transiently and never written to disk. **Both should be regenerated before launch** |
| D30 | Staff auth moved to password + TOTP behind `/framezee/a/auth/admin` | S9 | Customer auth unchanged (OTP). `requireStaff` demands **aal2**, so an email-OTP session cannot reach the dashboard even for a staff account — that closes the bypass the secret path alone would not |
| D31 | Password policy could not be hardened via the Management API | S9 | `password_min_length` (6), `password_hibp_enabled`, `security_update_password_require_reauthentication` and the MFA/password change email notices all silently ignored the PATCH — Pro-plan settings. **Set them in the dashboard**: Authentication → Policies |
| D32 | Read-only admins are enforced in `app/actions/admin.ts` only | S9 | `requireWrite` gates order moves and product/category toggles. Pricing, coupons and staff actions are super-admin only, so they are covered by role. Any *new* admin-writable action must call `requireWrite` |
| D33 | Mat board is free, and now switchable | S9 | Migration 0010 gives it a rate card (`mat_rates`). **Empty = free**, the same rule as the included glazing. Adding one band in Price & Material Control starts charging shop-wide with no deploy. Replaces the old `MAT_BOARD_PAISE = 0` constant (was D2) |
| D34 | Frame thickness moved from code into `frame_thicknesses` | S9 | Was two constants plus a hardcoded 12×8 rule in `lib/frame-options.ts`. Now rows with per-thickness `max_long`/`max_short` limits, editable by the super-admin; the sentence under the chips is generated from the rule |
| D35 | The ready-made size list is editable | S9 | `sizes` had no admin page at all. Add, hide and remove, with shape and area shown. Safe to remove: order items store their own width and height |
| D36 | Product page collected no photograph for the print service | S4 | **Fixed.** Ticking "Add my photo, printed and mounted" now requires an upload, shows it inside the frame with a DPI warning, and refuses Add to basket without it. `addToCart` re-checks server-side and stores the file on a `custom_designs` row |
| D37 | Catalogue listings still show empty frames | S4 | The client wants readymade frames listed **with artwork in them**. `products.artwork_image` and the upload now exist, so this is real photography, not code |

---

## Credentials still needed

| When | What | Status |
|---|---|---|
| **Sprint 6** | Razorpay test keys — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | **still blocking** |
| Sprint 7 | Shiprocket email, password, pickup location | still blocking |
| ~~Sprint 3~~ | ~~`SUPABASE_SERVICE_ROLE_KEY`~~ | ✅ set — admin creation, artwork download and uploads all depend on it |
| ~~Sprint 3~~ | ~~Fast2SMS~~ | ✅ set — phone OTP delivering through the Send SMS Hook |
| Sprint 11 | GSTIN, real rate cards, real photography | outstanding |
| Sprint 11 | `/privacy`, `/terms`, `/dispatch` copy — Razorpay will not approve a merchant account without them | outstanding (D25) |
| Before launch | Dashboard-only: `{{ .Token }}` email template (D21), password policy (D31), a real SMTP provider (D23) | outstanding |

**Regenerate before launch:** the Fast2SMS key and the Supabase personal access token were
both pasted in plain text during development (D29).
