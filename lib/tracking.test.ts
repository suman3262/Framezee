import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timelineFor, STAGES } from './tracking.ts'

const reached = (status: string) => timelineFor(status).filter((s) => s.reached).map((s) => s.key)
const current = (status: string) => timelineFor(status).find((s) => s.current)?.key

test('a paid order has only reached "order placed"', () => {
  assert.deepEqual(reached('paid'), ['placed'])
  assert.equal(current('paid'), 'placed')
})

test('ready to ship means it is in the workshop', () => {
  assert.deepEqual(reached('ready_to_ship'), ['placed', 'workshop'])
  assert.equal(current('ready_to_ship'), 'workshop')
})

test('shipped reaches dispatched, but not out for delivery', () => {
  // Nothing tells us a parcel is on the van until Shiprocket webhooks land (Sprint 7).
  assert.deepEqual(reached('shipped'), ['placed', 'workshop', 'dispatched'])
  assert.equal(current('shipped'), 'dispatched')
})

test('a delivered order shows delivered as the current stage', () => {
  assert.equal(current('delivered'), 'delivered')
  assert.ok(reached('delivered').includes('delivered'))
})

test('"out for delivery" is never marked reached, because nothing reports it yet', () => {
  for (const s of ['paid', 'ready_to_ship', 'shipped', 'delivered']) {
    assert.ok(!reached(s).includes('out'), s)
  }
})

test('a cancelled order shows no progress rather than guessing', () => {
  assert.deepEqual(reached('cancelled'), [])
  assert.equal(current('cancelled'), undefined)
})

test('every stage is either backed by a real status or explicitly unmapped', () => {
  for (const s of STAGES) {
    assert.ok(s.reachedAt === null || ['paid', 'ready_to_ship', 'shipped', 'delivered'].includes(s.reachedAt))
  }
})
