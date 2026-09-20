import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase session cookie and bounces signed-out visitors away from
 * private routes.
 *
 * Role checks are NOT done here. Middleware runs on the edge runtime, which has no TCP
 * sockets, so the postgres driver cannot run. app/(admin)/layout.tsx does the role check
 * with Drizzle before any admin page renders.
 */
const SIGNED_IN_ONLY = ['/account', '/cart', '/checkout', '/wishlist']
/** Staff have their own door, so a signed-out visitor to /admin is sent there instead. */
const ADMIN_SIGN_IN = '/framezee/a/auth/admin'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    },
  )

  // A magic link comes back as ?code=… on whatever path Supabase's Site URL points at.
  // Exchanging it here rather than in a dedicated /auth/callback means the link works
  // wherever it lands, with no redirect URL to allow-list.
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    const url = request.nextUrl.clone()
    url.searchParams.delete('code')
    // Strip the code from the address bar either way, so a refresh cannot replay it.
    if (error) url.searchParams.set('error', 'link')
    const redirect = NextResponse.redirect(url)
    for (const c of response.cookies.getAll()) redirect.cookies.set(c)
    return redirect
  }

  // getUser() revalidates with Supabase. getSession() only reads the cookie, which a
  // client can forge, so it must never be what guards a route.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const needsUser = SIGNED_IN_ONLY.some((p) => path === p || path.startsWith(p + '/'))

  if (path === '/admin' || path.startsWith('/admin/')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = ADMIN_SIGN_IN
      url.search = ''
      return NextResponse.redirect(url)
    }
    // Role, suspension and the second factor need the database and the MFA API, which
    // the edge runtime cannot reach. lib/auth.ts does all three before a page renders.
    return response
  }

  if (needsUser && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|figma|favicon.ico|.*\\.svg).*)'],
}
