/**
 * Does DATABASE_URL actually work?  npm run db:check
 *
 * Written because a wrong password fails identically to a wrong host once it reaches the
 * app: every page 500s and the real reason is three layers down. This says it in a line.
 */

import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('\n  DATABASE_URL is not set in .env\n')
  process.exit(1)
}

const parsed = new URL(url)
console.log(`\n  host      ${parsed.hostname}:${parsed.port}`)
console.log(`  user      ${parsed.username}`)
console.log(`  password  ${parsed.password.length} characters`)

if (parsed.hostname.startsWith('db.'))
  console.log('  note      direct host — IPv6 only, will NOT work on Vercel')

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 12, onnotice: () => {} })

try {
  const [row] = await sql`select current_database() as db, current_user as who`
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from public.users`
  console.log(`\n  ✓ connected to ${row.db} as ${row.who} — ${n} users\n`)
  process.exit(0)
} catch (e) {
  const err = e as { code?: string; message: string }
  console.error(`\n  ✗ ${err.code ?? ''} ${err.message}`)

  if (err.code === '28P01')
    console.error(
      '\n  The password is wrong. In Supabase: Settings → Database → Reset database\n' +
        '  password → Generate → then CLICK "Reset password" to apply it. Copying the\n' +
        '  generated string without clicking apply leaves the old password in place.\n',
    )
  else if (err.code === 'ENOTFOUND') console.error('\n  That hostname does not resolve.\n')
  else if (err.code === 'ETIMEDOUT' || err.code === 'CONNECT_TIMEOUT')
    console.error('\n  Reached nothing. Wrong port, or the host is unreachable from here.\n')
  else console.error('')

  process.exit(1)
}
