import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in')

// Supabase pools connections already; one client per process is enough.
// Notices are chatter (TRUNCATE CASCADE reports every table it touches) — dropping
// them keeps real errors visible.
const client = postgres(url, { prepare: false, onnotice: () => {} })

export const db = drizzle(client, { schema })
export { schema }
