/**
 * The order lifecycle, as ARCHITECTURE.md defines it:
 *   paid → ready_to_ship → shipped → delivered,  and  → cancelled → refunded
 *
 * Only these moves are allowed. A dropdown listing every status would let a tired
 * operator mark an unpaid order delivered.
 *
 * Lives outside the 'use server' file because that may only export async functions.
 */
export const ALLOWED: Record<string, string[]> = {
  paid: ['ready_to_ship', 'cancelled'],
  ready_to_ship: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: ['refunded'],
  refunded: [],
}

export const nextStatuses = (status: string): string[] => ALLOWED[status] ?? []

export const STATUS_LABEL: Record<string, string> = {
  ready_to_ship: 'Mark ready to ship',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  cancelled: 'Cancel order',
  refunded: 'Mark refunded',
}
