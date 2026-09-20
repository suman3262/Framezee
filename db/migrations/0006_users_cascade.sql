-- Remove staff rows that have no account behind them.
--
-- The 0001 trigger keeps public.users in step with auth.users on insert and update, but
-- nothing handles delete. A deleted account leaves its profile row behind, still holding
-- whatever role it had — and a ghost super_admin also defeats the "you cannot demote the
-- last super-admin" guard by making it look as though there are two.
--
-- A blanket foreign key onto auth.users was tried first and rejected: demo customers
-- created by scripts/demo-orders.ts exist only in public.users, precisely so nobody can
-- sign in as them. Those are harmless, being always role 'customer'. Only a ghost holding
-- a STAFF role is a security problem, so only those are removed here — and the guard in
-- app/actions/staff-admin.ts counts auth-backed super-admins, so a ghost cannot mask one.

delete from public.users u
where u.role in ('admin', 'super_admin')
  and not exists (select 1 from auth.users a where a.id = u.id)
  and not exists (select 1 from public.orders o where o.user_id = u.id);
