-- Frame thickness and the mat board move out of code and into the database.
--
-- Both were hardcoded in lib/frame-options.ts: two thicknesses, a rule that half-inch
-- only goes up to 12 x 8 in, and MAT_BOARD_PAISE = 0. None of it could be changed without
-- a deploy, which is the wrong place for a price the client wants to switch on later.

create table if not exists "frame_thicknesses" (
  "id" uuid primary key default gen_random_uuid(),
  "tenths" integer not null unique,            -- 5 = half an inch
  "label" text not null,                       -- "1/2 inch"
  -- A thin moulding bows under a large sheet of glazing, so a thickness can cap the
  -- frame it is offered on. Null means no limit.
  "max_long_tenths" integer,
  "max_short_tenths" integer,
  "sort_order" integer not null default 0,
  "active" boolean not null default true
);

-- The two that were in code, with the half-inch rule carried over exactly.
insert into "frame_thicknesses" ("tenths", "label", "max_long_tenths", "max_short_tenths", "sort_order")
values (5, '1/2 inch', 120, 80, 0),
       (10, '1 inch', null, null, 1)
on conflict ("tenths") do nothing;

-- The mat board's rate card. Empty means free at every size, which is exactly how
-- glazing_rates already works for the included glazing — same rule, no new concept.
create table if not exists "mat_rates" (
  "id" uuid primary key default gen_random_uuid(),
  "max_width_tenths" integer not null,
  "max_height_tenths" integer not null,
  "rate_paise_per_sq_in" integer not null,
  "active" boolean not null default true
);

-- Deliberately left empty: the mat is free for launch. Adding one band starts charging
-- for it across the whole shop, with no code change.

alter table "frame_thicknesses" enable row level security;
alter table "mat_rates" enable row level security;

-- Catalogue data: anyone may read it, only the service role writes it.
drop policy if exists "frame_thicknesses read" on "frame_thicknesses";
create policy "frame_thicknesses read" on "frame_thicknesses" for select using (true);

drop policy if exists "mat_rates read" on "mat_rates";
create policy "mat_rates read" on "mat_rates" for select using (true);
