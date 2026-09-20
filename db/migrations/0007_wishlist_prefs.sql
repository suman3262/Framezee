CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid,
	"width_tenths" integer NOT NULL,
	"height_tenths" integer NOT NULL,
	"material_id" uuid NOT NULL,
	"glazing_option_id" uuid,
	"thickness_tenths" integer DEFAULT 10 NOT NULL,
	"mat_board" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_glazing_option_id_glazing_options_id_fk" FOREIGN KEY ("glazing_option_id") REFERENCES "public"."glazing_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_one_per_config" ON "wishlist_items" USING btree ("user_id","product_id","width_tenths","height_tenths","material_id","thickness_tenths","mat_board");--> statement-breakpoint
-- New tables do not inherit the lockdown from 0002_enable_rls.
ALTER TABLE "wishlist_items" ENABLE ROW LEVEL SECURITY;
