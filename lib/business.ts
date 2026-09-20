/**
 * Framezee's real-world details, confirmed by the client against the PDP footer.
 * These end up on GST invoices, so they live in one place rather than being retyped
 * into every template.
 */
export const BUSINESS = {
  legalName: 'Framezee Craft Framing Pvt Ltd',
  tradingName: 'Framezee',
  tagline:
    'Handcrafted archival mouldings and precision custom framing delivered securely across India. Elevating memories and art into museum-grade showcases.',
  address: {
    line1: '12/A College Road',
    line2: 'Krishnagar, Nadia',
    state: 'West Bengal',
    country: 'India',
    pincode: '741101',
  },
  phone: '+91 98765 43210',
  phoneHref: 'tel:+919876543210',
  email: 'support@framezee.in',
  helpCentre: 'help.framezee.in',
  /** Public profiles. Not secrets and not per-environment, so config rather than .env. */
  instagram: 'https://instagram.com/framezee',
  pinterest: 'https://pinterest.com/framezee',
  copyrightYear: 2025,
} as const

export const addressLines = [
  `${BUSINESS.address.line1}, ${BUSINESS.address.line2}`,
  `${BUSINESS.address.state}, ${BUSINESS.address.country} – ${BUSINESS.address.pincode}`,
]
