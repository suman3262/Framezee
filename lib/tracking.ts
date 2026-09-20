/**
 * The tracking timeline a customer sees.
 *
 * The design draws five stages — Order placed, In the workshop, Dispatched, Out for
 * delivery, Delivered — but the order model has four, because the client declined a
 * separate production step in Sprint 0 (a status nobody updates is worse than none).
 *
 * Rather than invent a status, the four real ones are mapped onto the drawn labels and
 * the two that have no source are shown as not-yet-reached. "Out for delivery" becomes
 * real when Shiprocket webhooks land in Sprint 7. Recorded as conflict C1.
 */

export type Stage = { key: string; label: string; detail: string; reachedAt: 'paid' | 'ready_to_ship' | 'shipped' | 'delivered' | null }

export const STAGES: Stage[] = [
  { key: 'placed', label: 'Order placed', detail: 'Cut list received and confirmed', reachedAt: 'paid' },
  { key: 'workshop', label: 'In the workshop', detail: 'Moulding cut, joined, glazed and packed flat', reachedAt: 'ready_to_ship' },
  { key: 'dispatched', label: 'Dispatched', detail: 'Handed to the courier with tracking', reachedAt: 'shipped' },
  { key: 'out', label: 'Out for delivery', detail: 'On the van for today', reachedAt: null },
  { key: 'delivered', label: 'Delivered', detail: 'Signed for at the door', reachedAt: 'delivered' },
]

const ORDER = ['paid', 'ready_to_ship', 'shipped', 'delivered'] as const

/** How far along a given order is, as a list of reached / not-reached stages. */
export function timelineFor(status: string): Array<Stage & { reached: boolean; current: boolean }> {
  const position = ORDER.indexOf(status as (typeof ORDER)[number])

  let lastReached = -1
  const rows = STAGES.map((s, i) => {
    const reached = s.reachedAt !== null && position >= ORDER.indexOf(s.reachedAt)
    if (reached) lastReached = i
    return { ...s, reached, current: false }
  })

  if (lastReached >= 0) rows[lastReached].current = true
  return rows
}
