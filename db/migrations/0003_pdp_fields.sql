CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "thickness_tenths" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "mat_board" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- materials already holds rows, so add nullable, backfill, then enforce.
ALTER TABLE "materials" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "materials" SET "slug" = trim(both '-' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')));--> statement-breakpoint
ALTER TABLE "materials" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "swatch" text DEFAULT '#cccccc' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "thickness_tenths" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "mat_board" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "number" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_new" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "specs" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rating_tenths" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_slug_unique" UNIQUE("slug");
--> statement-breakpoint
-- New tables do not inherit the lockdown from 0002_enable_rls.
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;