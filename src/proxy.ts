import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/auth']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (!user) {
    if (isPublicRoute) return supabaseResponse
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // User is authenticated — check role for protected routes
  if (isPublicRoute && pathname.startsWith('/login')) {
    // Already logged in, redirect away from login
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    if (role === 'manager') return NextResponse.redirect(new URL('/manager', request.url))
    if (role === 'werkstudent') return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  if (isPublicRoute) {
    return supabaseResponse
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  const isActive = profile?.is_active !== false && profile?.is_active !== null

  // Deactivated users can only see /deactivated
  if (!isActive) {
    if (pathname === '/deactivated') return supabaseResponse
    return NextResponse.redirect(new URL('/deactivated', request.url))
  }

  // Active users should not visit /deactivated
  if (pathname === '/deactivated') {
    if (role === 'manager') return NextResponse.redirect(new URL('/manager', request.url))
    if (role === 'werkstudent') return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  if (!role) {
    if (pathname === '/pending') return supabaseResponse
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  // User has a role — redirect away from /pending to their correct page
  if (pathname === '/pending') {
    if (role === 'manager') return NextResponse.redirect(new URL('/manager', request.url))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (role === 'werkstudent' && pathname.startsWith('/manager')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (role === 'manager' && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/manager', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
