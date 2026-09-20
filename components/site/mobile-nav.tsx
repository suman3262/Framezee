'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Figma 2:959 — bottom tab bar, mobile only. */
const ITEMS = [
  { href: '/', icon: '/figma/nav-home.svg', label: 'Home' },
  { href: '/custom', icon: '/figma/nav-studio.svg', label: 'Custom Studio' },
  { href: '/browse', icon: '/figma/nav-browse.svg', label: 'Browse' },
  { href: '/wishlist', icon: '/figma/nav-wishlist.svg', label: 'Wishlist' },
  { href: '/cart', icon: '/figma/nav-cart.svg', label: 'Cart', badge: 2 },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page/95 px-2 pb-2 pt-[9px] backdrop-blur-[12px] md:hidden dark:bg-surface/95">
      <ul className="mx-auto flex max-w-[448px] items-center justify-center">
        {ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <li key={item.href} className="w-[74.8px]">
              <Link href={item.href} className="flex flex-col items-center gap-1">
                <span className="relative block size-5">
                  <img src={item.icon} alt="" className="size-5 dark:invert" />
                  {item.badge && (
                    <span className="absolute -right-2 -top-1 grid size-[14px] place-items-center rounded-full bg-[#f59e0b] text-[9px] font-extrabold leading-[13.5px] text-ink">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span
                  className={`text-center text-[10px] leading-[15px] ${
                    active ? 'font-bold text-violet-deep' : 'font-medium text-[#71717a]'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Figma 2:598 — floating support chat launcher. */
export function ChatBubble() {
  return (
    <button
      type="button"
      aria-label="Open chat with Framezee support"
      className="fixed bottom-[72px] right-4 z-40 grid size-14 place-items-center rounded-full bg-violet shadow-lg md:bottom-6 md:right-6"
    >
      <img src="/figma/chat.svg" alt="" className="size-7" />
    </button>
  )
}
