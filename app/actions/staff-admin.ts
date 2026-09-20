'use server'

import { randomBytes } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { users } from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'
import { createAdminClient, SERVICE_KEY_MISSING } from '@/lib/supabase/admin.ts'
import { normalizePhone } from '@/lib/phone.ts'

export type StaffResult = { error?: string; ok?: string; password?: string }

const PERMISSIONS = ['read', 'read_write'] as const
type Permission = (typeof PERMISSIONS)[number]

/**
 * A first password the super-admin reads out once. It is not meant to be remembered —
 * the authenticator enrolment on first sign-in is what actually secures the account.
 * Ambiguous characters are left out so it survives being read aloud down a phone line.
 */
function firstPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(20)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/**
 * Creates an admin outright: auth account, profile row, permission, all in one step.
 *
 * The alternative — "ask them to sign up, then promote them" — meant a window where a
 * half-made staff member existed, and it could not carry a name or a phone number.
 */
export async function createAdmin(_prev: StaffResult, form: FormData): Promise<StaffResult> {
  const me = await requireSuperAdmin()

  const name = String(form.get('name') ?? '').trim()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const rawPhone = String(form.get('phone') ?? '').trim()
  const permission = String(form.get('permission') ?? 'read') as Permission

  if (!name) return { error: 'Enter their full name.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email address.' }
  if (!PERMISSIONS.includes(permission)) return { error: 'Choose read or read and write.' }

  const phone = normalizePhone(rawPhone)
  if (rawPhone && !phone) return { error: 'Enter a 10-digit Indian mobile number, or leave it blank.' }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing && existing.role !== 'customer')
    return { error: `${email} is already ${existing.role.replace('_', ' ')}.` }

  // A phone number is unique across all accounts, so catch the clash here rather than
  // letting the insert fail with a constraint name nobody can read.
  if (phone) {
    const [clash] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1)
    if (clash && clash.id !== existing?.id) return { error: 'That mobile number is already on another account.' }
  }

  const supabase = createAdminClient()
  if (!supabase) return { error: SERVICE_KEY_MISSING }

  const password = firstPassword()

  // Someone who already shops here keeps their account and their orders; they gain a
  // password and a role rather than getting a second identity.
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password })
    if (error) return { error: `Could not set a password: ${error.message}` }

    await db
      .update(users)
      .set({ role: 'admin', permission, name, phone: phone ?? existing.phone, suspendedAt: null, grantedBy: me.email })
      .where(eq(users.id, existing.id))
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // a super-admin vouching for them is the confirmation
      user_metadata: { name },
    })
    if (error || !data.user) return { error: `Could not create the account: ${error?.message}` }

    // The auth trigger has already made the profile row; fill in what it cannot know.
    await db
      .update(users)
      .set({ role: 'admin', permission, name, phone, grantedBy: me.email })
      .where(eq(users.id, data.user.id))
  }

  revalidatePath('/admin/staff')
  return {
    ok: `${name} can now sign in. Give them this password once — they will set up an authenticator on first sign-in.`,
    password,
  }
}

/** Read-only ⇄ read and write. Super-admins are not subject to it. */
export async function setPermission(_prev: StaffResult, form: FormData): Promise<StaffResult> {
  const me = await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const permission = String(form.get('permission') ?? '') as Permission
  if (!PERMISSIONS.includes(permission)) return { error: 'Unknown permission.' }
  if (id === me.id) return { error: 'You cannot change your own access.' }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!target) return { error: 'That account no longer exists.' }
  if (target.role === 'customer') return { error: 'That account is not staff.' }

  await db.update(users).set({ permission }).where(eq(users.id, id))
  revalidatePath('/admin/staff')
  return {
    ok: `${target.name || target.email} is now ${permission === 'read_write' ? 'read and write' : 'read-only'}.`,
  }
}

/**
 * Suspend: keep the role and the permission, refuse the dashboard. Reversible without
 * retyping anything, which is what makes it the safe thing to reach for when something
 * looks wrong at 2am.
 */
export async function setSuspended(_prev: StaffResult, form: FormData): Promise<StaffResult> {
  const me = await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const suspend = String(form.get('suspend') ?? '') === 'true'
  if (id === me.id) return { error: 'You cannot suspend yourself.' }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!target) return { error: 'That account no longer exists.' }

  if (suspend && target.role === 'super_admin') {
    const guard = await lastLiveSuperAdmin(id)
    if (guard) return { error: guard }
  }

  await db.update(users).set({ suspendedAt: suspend ? new Date() : null }).where(eq(users.id, id))
  revalidatePath('/admin/staff')
  return { ok: `${target.name || target.email} is ${suspend ? 'suspended' : 'active again'}.` }
}

/**
 * Revoke: back to being a customer. Their orders and addresses are untouched — this
 * removes access, not the person.
 */
export async function revokeStaff(_prev: StaffResult, form: FormData): Promise<StaffResult> {
  const me = await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  if (id === me.id) return { error: 'You cannot revoke your own access. Ask another super-admin.' }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!target) return { error: 'That account no longer exists.' }
  if (target.role === 'customer') return { error: 'That account is not staff.' }

  if (target.role === 'super_admin') {
    const guard = await lastLiveSuperAdmin(id)
    if (guard) return { error: guard }
  }

  await db
    .update(users)
    .set({ role: 'customer', permission: 'read', suspendedAt: null, grantedBy: null })
    .where(eq(users.id, id))
  revalidatePath('/admin/staff')
  return { ok: `${target.name || target.email} no longer has dashboard access.` }
}

/** Promote an admin to super-admin, or demote one back. */
export async function setSuperAdmin(_prev: StaffResult, form: FormData): Promise<StaffResult> {
  const me = await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const promote = String(form.get('promote') ?? '') === 'true'
  if (id === me.id) return { error: 'You cannot change your own role.' }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!target) return { error: 'That account no longer exists.' }
  if (target.role === 'customer') return { error: 'Make them an admin first.' }

  if (!promote) {
    const guard = await lastLiveSuperAdmin(id)
    if (guard) return { error: guard }
  }

  await db
    .update(users)
    .set({ role: promote ? 'super_admin' : 'admin', permission: 'read_write' })
    .where(eq(users.id, id))
  revalidatePath('/admin/staff')
  return { ok: `${target.name || target.email} is now ${promote ? 'a super-admin' : 'an admin'}.` }
}

/**
 * Refuses to remove the last super-admin who can actually sign in.
 *
 * Only accounts with a matching auth.users row count. A profile row left behind by a
 * deleted account must not look like a spare super-admin — otherwise the real last one
 * could be demoted and nobody could grant the role back without database access.
 */
async function lastLiveSuperAdmin(id: string): Promise<string | null> {
  const rows = await db.execute<{ live_total: number; target_is_live: boolean }>(sql`
    select
      (select count(*)::int from public.users u
         join auth.users a on a.id = u.id
        where u.role = 'super_admin' and u.suspended_at is null) as live_total,
      exists (select 1 from auth.users a where a.id = ${id}) as target_is_live
  `)
  const liveTotal = Number(rows[0]?.live_total ?? 0)
  const targetIsLive = Boolean(rows[0]?.target_is_live)

  return targetIsLive && liveTotal <= 1
    ? 'This is the only super-admin who can sign in. Promote someone else first.'
    : null
}
