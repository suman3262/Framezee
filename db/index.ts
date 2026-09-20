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
const client = postgres(url, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
})

export const db = drizzle(client, { schema })
export { schema }
