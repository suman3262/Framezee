import { TopBars } from '@/components/site/top-bars.tsx'
import { Header } from '@/components/site/header.tsx'
import { SupportBar, Footer } from '@/components/site/footer.tsx'
import { MobileNav, ChatBubble } from '@/components/site/mobile-nav.tsx'
import { getCurrentUser } from '@/lib/auth.ts'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <>
      <TopBars />
      <Header user={user} />
      {/* Bottom padding clears the mobile tab bar. */}
      <main className="pb-24 md:pb-0">{children}</main>
      <SupportBar />
      <Footer />
      <MobileNav />
      <ChatBubble />
    </>
  )
}
