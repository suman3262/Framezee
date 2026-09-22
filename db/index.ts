import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in')

/*
 * One pool, sized above the widest page.
 *
 * `max: 1` was tried for serverless on the theory that each request is its own instance.
 * On Vercel's Fluid Compute that is false: the logs showed a single instance serving 23
 * concurrent requests, all queued behind one connection and all timing out.
 *
 * Five was the next guess, and it hung the admin outright. postgres.js only misbehaves
 * once a query has to *queue* — a page firing eleven queries in a Promise.all against a
 * pool of five works on the first request and then, once those connections have been
 * idle a moment, silently never dispatches the queued six. No error, no timeout: the
 * render waits forever and Vercel kills the function at its limit. Reproduced 3/3 with
 * plain postgres.js, and it goes away entirely at `max: 20`, where nothing queues.
 *
 * So the rule this number has to keep: larger than the most queries any one page fires
 * at once. /admin/pricing is the widest at eleven. Connecting through the transaction
 * pooler, these are pgbouncer client slots rather than Postgres backends, so twenty per
 * instance is cheap — the database itself stays at a handful of connections.
 *
 * `prepare: false` is required by the transaction pooler and harmless anywhere else.
 * `connect_timeout` is deliberately short: failing in 10 seconds is far better than
 * holding a serverless instance open for five minutes.
 *
 * Notices are chatter (TRUNCATE CASCADE reports every table it touches) — dropping them
 * keeps real errors visible.
 */
const client = postgres(url, {
  prepare: false,
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
})

export const db = drizzle(client, { schema })
export { schema }
