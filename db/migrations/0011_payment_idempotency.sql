-- One order per Razorpay order, enforced by the database.
--
-- Razorpay retries a webhook until it gets a 2xx, and retries can overlap. A SELECT-then-
-- INSERT check loses that race and the customer gets charged once but receives two
-- frames. A unique index cannot lose it.
create unique index if not exists "payments_razorpay_order_id_key"
  on "payments" ("razorpay_order_id")
  where "razorpay_order_id" is not null;
