/** Identifier parsing for sign-in. No database imports, so it stays testable. */

/** Anything that looks like an email goes by email; everything else is an Indian mobile. */
export function channelFor(identifier: string): 'email' | 'sms' {
  return identifier.includes('@') ? 'email' : 'sms'
}

/**
 * 9876543210, 09876543210, +91 98765 43210, 0091-98765-43210 → +919876543210
 * Returns null for anything that is not a valid Indian mobile number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '')
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  // Indian mobile numbers are 10 digits starting 6-9.
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null
}

/** +919876543210 → +91 98765 43210, for showing the customer where the code went. */
export const formatPhone = (e164: string): string =>
  /^\+91\d{10}$/.test(e164) ? `+91 ${e164.slice(3, 8)} ${e164.slice(8)}` : e164
