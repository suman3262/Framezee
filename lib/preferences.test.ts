import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readPreferences, DEFAULT_PREFERENCES } from './preferences.ts'

test('a customer who has never chosen gets the defaults', () => {
  assert.deepEqual(readPreferences(null), DEFAULT_PREFERENCES)
  assert.deepEqual(readPreferences(undefined), DEFAULT_PREFERENCES)
  assert.deepEqual(readPreferences({}), DEFAULT_PREFERENCES)
})

test('order updates can never be switched off', () => {
  // Not marketing — it is how someone learns their frame shipped.
  assert.equal(readPreferences({ orderUpdates: false }).orderUpdates, true)
})

test('stored choices are honoured', () => {
  const p = readPreferences({ newMouldings: true, offers: false, whatsapp: false })
  assert.equal(p.newMouldings, true)
  assert.equal(p.offers, false)
  assert.equal(p.whatsapp, false)
})

test('junk in the column falls back to the default rather than throwing', () => {
  for (const junk of ['nonsense', 42, [], { offers: 'yes', whatsapp: null }]) {
    const p = readPreferences(junk)
    assert.equal(typeof p.offers, 'boolean')
    assert.equal(typeof p.whatsapp, 'boolean')
  }
})
