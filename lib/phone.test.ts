import { test } from 'node:test'
import assert from 'node:assert/strict'
import { channelFor, normalizePhone, formatPhone } from './phone.ts'

test('an email address is routed to email, anything else to SMS', () => {
  assert.equal(channelFor('suman@example.com'), 'email')
  assert.equal(channelFor('9876543210'), 'sms')
  assert.equal(channelFor('+91 98765 43210'), 'sms')
})

test('Indian mobile numbers normalise to E.164 however they are typed', () => {
  for (const input of [
    '9876543210',
    '09876543210',
    '+919876543210',
    '+91 98765 43210',
    '0091-98765-43210',
    '  98765 43210  ',
  ]) {
    assert.equal(normalizePhone(input), '+919876543210', input)
  }
})

test('numbers that are not Indian mobiles are rejected, not guessed at', () => {
  for (const bad of [
    '123456789', // too short
    '98765432100', // too long
    '5876543210', // Indian mobiles start 6-9
    '1876543210',
    '+14155552671', // US number
    'not a phone',
    '',
  ]) {
    assert.equal(normalizePhone(bad), null, bad)
  }
})

test('a normalised number is shown back in a readable form', () => {
  assert.equal(formatPhone('+919876543210'), '+91 98765 43210')
  assert.equal(formatPhone('+14155552671'), '+14155552671') // left alone
})
