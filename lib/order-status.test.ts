import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALLOWED, nextStatuses } from './order-status.ts'

test('an order can only move forward one step at a time', () => {
  assert.deepEqual(nextStatuses('paid'), ['ready_to_ship', 'cancelled'])
  assert.deepEqual(nextStatuses('ready_to_ship'), ['shipped', 'cancelled'])
  assert.deepEqual(nextStatuses('shipped'), ['delivered'])
})

test('a paid order cannot jump straight to delivered', () => {
  assert.ok(!nextStatuses('paid').includes('delivered'))
  assert.ok(!nextStatuses('paid').includes('shipped'))
})

test('delivered and refunded are the end of the line', () => {
  assert.deepEqual(nextStatuses('delivered'), [])
  assert.deepEqual(nextStatuses('refunded'), [])
})

test('a shipped order can no longer be cancelled', () => {
  // It is already with the courier — cancelling it in the admin would be a lie.
  assert.ok(!nextStatuses('shipped').includes('cancelled'))
})

test('only a cancelled order can be refunded', () => {
  assert.deepEqual(nextStatuses('cancelled'), ['refunded'])
  for (const s of ['paid', 'ready_to_ship', 'shipped', 'delivered']) {
    assert.ok(!nextStatuses(s).includes('refunded'), s)
  }
})

test('every status a move points at is itself a known status', () => {
  const known = new Set(Object.keys(ALLOWED))
  for (const [from, tos] of Object.entries(ALLOWED)) {
    for (const to of tos) assert.ok(known.has(to), `${from} -> ${to} is not a status`)
  }
})

test('an unknown status offers nothing rather than throwing', () => {
  assert.deepEqual(nextStatuses('nonsense'), [])
})
