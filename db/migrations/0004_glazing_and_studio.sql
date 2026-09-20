CREATE TABLE "glazing_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"included" boolean DEFAULT false NOT NULL,
	"gst_rate_bp" integer NOT NULL,
	"hsn_code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "glazing_options_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "glazing_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"glazing_option_id" uuid NOT NULL,
	"max_width_tenths" integer NOT NULL,
	"max_height_tenths" integer NOT NULL,
	"rate_paise_per_sq_in" integer NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "glazing_option_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_designs" ADD COLUMN "glazing_option_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_designs" ADD COLUMN "thickness_tenths" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_designs" ADD COLUMN "mat_board" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_designs" ADD COLUMN "mat_colour" text;--> statement-breakpoint
ALTER TABLE "custom_designs" ADD COLUMN "wall_preset" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "glazing_name" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "mat_colour" text;--> statement-breakpoint
ALTER TABLE "glazing_rates" ADD CONSTRAINT "glazing_rates_glazing_option_id_glazing_options_id_fk" FOREIGN KEY ("glazing_option_id") REFERENCES "public"."glazing_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_glazing_option_id_glazing_options_id_fk" FOREIGN KEY ("glazing_option_id") REFERENCES "public"."glazing_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_designs" ADD CONSTRAINT "custom_designs_glazing_option_id_glazing_options_id_fk" FOREIGN KEY ("glazing_option_id") REFERENCES "public"."glazing_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- New tables do not inherit the lockdown from 0002_enable_rls.
ALTER TABLE "glazing_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "glazing_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Storage for the Custom Studio: the customer's artwork and their room photo.
-- Private, so nothing is readable without a signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio', 'studio', false, 26214400,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;--> statement-breakpoint

-- Everything a customer uploads lives under their own user id, and the policies say so.
-- Without this an authenticated customer could read or overwrite someone else's photo.
drop policy if exists "studio_insert_own" on storage.objects;--> statement-breakpoint
create policy "studio_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'studio' and (storage.foldername(name))[1] = auth.uid()::text);--> statement-breakpoint

drop policy if exists "studio_select_own" on storage.objects;--> statement-breakpoint
create policy "studio_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'studio' and (storage.foldername(name))[1] = auth.uid()::text);--> statement-breakpoint

drop policy if exists "studio_update_own" on storage.objects;--> statement-breakpoint
create policy "studio_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'studio' and (storage.foldername(name))[1] = auth.uid()::text);--> statement-breakpoint

drop policy if exists "studio_delete_own" on storage.objects;--> statement-breakpoint
create policy "studio_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'studio' and (storage.foldername(name))[1] = auth.uid()::text);
