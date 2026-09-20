/** What a customer is sent, and what they get if they have never chosen. */

export type Preferences = {
  orderUpdates: boolean
  newMouldings: boolean
  offers: boolean
  whatsapp: boolean
}

export const PREFERENCE_FIELDS: Array<{
  key: keyof Preferences
  label: string
  hint: string
  locked?: string
}> = [
  {
    key: 'orderUpdates',
    label: 'Order and dispatch updates',
    hint: 'Cut, glazed, shipped — one email each.',
    locked: 'Always on, so you know where your frames are.',
  },
  { key: 'newMouldings', label: 'New mouldings', hint: 'When a finish joins the range.' },
  { key: 'offers', label: 'Offers and set pricing', hint: 'Occasional, never more than monthly.' },
  { key: 'whatsapp', label: 'WhatsApp order alerts', hint: 'Delivery OTP and real-time tracking links.' },
]

/** Order updates default on and cannot be switched off — they are not marketing. */
export const DEFAULT_PREFERENCES: Preferences = {
  orderUpdates: true,
  newMouldings: false,
  offers: true,
  whatsapp: true,
}

export function readPreferences(stored: unknown): Preferences {
  const raw = (stored ?? {}) as Partial<Record<keyof Preferences, unknown>>
  return {
    orderUpdates: true, // never off
    newMouldings: typeof raw.newMouldings === 'boolean' ? raw.newMouldings : DEFAULT_PREFERENCES.newMouldings,
    offers: typeof raw.offers === 'boolean' ? raw.offers : DEFAULT_PREFERENCES.offers,
    whatsapp: typeof raw.whatsapp === 'boolean' ? raw.whatsapp : DEFAULT_PREFERENCES.whatsapp,
  }
}
