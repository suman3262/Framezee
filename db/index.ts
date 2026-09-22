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
 * Pool size depends on where this runs, and getting it wrong is slow rather than broken.
 *
 * Serverless: every request can be a fresh instance, so ten connections each exhausts
 * Supabase's pooler long before traffic does — one apiece.
 *
 * A long-running server is the opposite. One page fires half a dozen queries in a
 * Promise.all, and max:1 serialises them behind a single connection; locally that turned
 * 200ms pages into two-minute ones.
 */
const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

const client = postgres(url, {
  prepare: false, // required by the transaction pooler, harmless anywhere else
  max: serverless ? 1 : 10,
  idle_timeout: serverless ? 20 : 0,
  connect_timeout: 10,
  onnotice: () => {},
})

export const db = drizzle(client, { schema })
export { schema }
