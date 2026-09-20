'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startRazorpayPayment } from '@/app/actions/payment.ts'
import { fmtInr } from '@/lib/pricing.ts'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

/** Razorpay's own script. Loaded on demand, so the checkout page stays light. */
function loadCheckoutScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

/**
 * Opens Razorpay's modal, then sends the customer to the confirmation page to wait.
 *
 * It deliberately does not create the order. The webhook does that, having heard from
 * Razorpay rather than from a browser. A customer who pays and closes the tab still gets
 * their frame, and a browser claiming "paid" gets nothing.
 */
export function PayButton({
  addressId,
  totalPaise,
  disabled,
}: {
  addressId: string | null
  totalPaise: number
  disabled?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    if (!addressId) return setError('Choose a delivery address first.')
    setError(null)
    setBusy(true)

    const started = await startRazorpayPayment(addressId)
    if (!started.ok) {
      setBusy(false)
      return setError(started.error)
    }

    if (!(await loadCheckoutScript()) || !window.Razorpay) {
      setBusy(false)
      return setError('Could not reach Razorpay. Check your connection and try again.')
    }

    const rzp = new window.Razorpay({
      key: started.keyId,
      order_id: started.razorpayOrderId,
      amount: started.amountPaise,
      currency: 'INR',
      name: started.name,
      description: started.description,
      prefill: started.prefill,
      theme: { color: '#6c3ce9' },
      handler: () => {
        // Say nothing about success here — the confirmation page waits for the webhook.
        router.push(`/checkout/done?o=${encodeURIComponent(started.razorpayOrderId)}`)
      },
      modal: {
        ondismiss: () => {
          setBusy(false)
          setError('Payment cancelled. Your basket is still here.')
        },
      },
    })

    rzp.open()
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={pay}
        disabled={busy || disabled || !addressId}
        className="w-full rounded-full bg-accent py-3 font-display text-base font-bold text-accent-ink shadow-[0_4px_6px_rgba(255,195,41,0.35)] disabled:opacity-50"
      >
        {busy ? 'Opening Razorpay…' : `Pay ${fmtInr(totalPaise)}`}
      </button>

      {error && <p className="text-center text-xs font-medium text-red-600">{error}</p>}

      <p className="text-center text-[11px] leading-4 text-faint">
        Card, UPI, netbanking or wallet. Your order is created once Razorpay confirms the
        payment, so closing this tab will not lose it.
      </p>
    </div>
  )
}
