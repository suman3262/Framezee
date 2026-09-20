-- Staff accounts gain a permission level and a suspension switch.
--
-- Why two columns rather than more roles: role answers "which pages", permission answers
-- "may they change anything". Folding them together would mean four roles today and eight
-- the next time someone asks for a read-only super-admin.
--
-- Suspension is deliberately separate from revoking. Revoking sets role back to customer
-- and throws the permission away; suspending keeps both, so access can be restored
-- without retyping anything. A suspended admin still owns their orders as a customer.

create type "permission" as enum ('read', 'read_write');

alter table "users"
  add column if not exists "permission" "permission" not null default 'read',
  add column if not exists "suspended_at" timestamptz,
  -- Who granted this. Kept as text, not a foreign key: if the granting super-admin is
  -- ever deleted, the audit trail of who let someone in must survive them.
  add column if not exists "granted_by" text;

-- Existing staff keep the access they already had; nobody is silently downgraded.
update "users" set "permission" = 'read_write' where "role" in ('admin', 'super_admin');

-- A suspended account is refused at the door, so the lookup runs on every admin page.
create index if not exists "users_staff_idx" on "users" ("role") where "role" <> 'customer';
