import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in')

/*
 * One connection per process, deliberately.
 *
 * On a serverless host every request can be a fresh instance, and a pool of ten per
 * instance exhausts Supabase's pooler long before traffic does. `prepare: false` is
 * required by the transaction pooler, which does not keep a session between statements.
 *
 * Notices are chatter (TRUNCATE CASCADE reports every table it touches) — dropping them
 * keeps real errors visible.
 */
/*
 * One modest pool, everywhere.
 *
 * `max: 1` was tried for serverless on the theory that each request is its own instance.
 * On Vercel's Fluid Compute that is false: the logs showed a single instance serving 23
 * concurrent requests, all of them queued behind one connection, all of them timing out
 * at 300 seconds. A page fires several queries in a Promise.all, so one connection is
 * never enough.
 *
 * Five is small enough that many instances do not exhaust Supabase's pooler, and large
 * enough that a page's queries actually run in parallel.
 *
 * `prepare: false` is required by the transaction pooler and harmless anywhere else.
 * `connect_timeout` is deliberately short: failing in 10 seconds is far better than
 * holding a serverless instance open for five minutes.
 */
const client = postgres(url, {
  prepare: false,
  max: 5,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
})

export const db = drizzle(client, { schema })
export { schema }
