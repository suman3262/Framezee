/**
 * Minimal Chrome DevTools Protocol driver, on Node's built-in WebSocket — no dependency.
 *
 * Used to verify forms and server actions the way a customer meets them: real clicks in a
 * real browser. Hand-encoding Next's server-action wire format proved unreliable, and a
 * form that only "works" in theory is not verified.
 *
 *   chromium --headless --remote-debugging-port=9222 --user-data-dir=/tmp/x about:blank &
 *   node --env-file=.env yourscript.mjs
 */
import { readFileSync } from 'node:fs'

const PORT = 9222
const base = `http://127.0.0.1:${PORT}`

export async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`${base}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return open(page.webSocketDebuggerUrl)
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('chromium debugger never came up')
}

function open(url) {
  const ws = new WebSocket(url)
  let id = 0
  const pending = new Map()
  const ready = new Promise((res, rej) => {
    ws.onopen = () => res()
    ws.onerror = (e) => rej(new Error('ws error'))
  })
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  }
  return ready.then(() => ({
    send(method, params = {}) {
      const mid = ++id
      return new Promise((resolve, reject) => {
        pending.set(mid, { resolve, reject })
        ws.send(JSON.stringify({ id: mid, method, params }))
      })
    },
    close: () => ws.close(),
  }))
}

export async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed')
  return r.result.value
}

export function cookiesFromFile(file = '.cookie') {
  return readFileSync(file, 'utf8')
    .split('; ')
    .map((pair) => {
      const i = pair.indexOf('=')
      return { name: pair.slice(0, i), value: pair.slice(i + 1), domain: 'localhost', path: '/' }
    })
}
