import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withCleanSession } from '@/lib/session-cleaner'

const PUBLIC_ROUTES = ['/login', '/auth', '/api/auth/dev-login']

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
          withCleanSession((cookies) =>
            cookies.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          )(cookiesToSet)
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
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in — redirect away from /login
  if (isPublicRoute && pathname.startsWith('/login')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    const admin = profile?.is_admin ?? false

    if (role === 'manager') return NextResponse.redirect(new URL('/manager', request.url))
    if (admin) return NextResponse.redirect(new URL('/admin', request.url))
    if (role === 'werkstudent') return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  if (isPublicRoute) {
    return supabaseResponse
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, is_admin')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  const isActive = profile?.is_active !== false && profile?.is_active !== null
  const isAdmin = profile?.is_admin ?? false

  // Deactivated users
  if (!isActive) {
    if (pathname === '/deactivated') return supabaseResponse
    return NextResponse.redirect(new URL('/deactivated', request.url))
  }

  if (pathname === '/deactivated') {
    if (role === 'manager') return NextResponse.redirect(new URL('/manager', request.url))
    if (isAdmin) return NextResponse.redirect(new URL('/admin', request.url))
    if (role === 'werkstudent') return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  // Guard /admin routes — only admins may access them
  if (pathname.startsWith('/admin')) {
    if (!isAdmin) {
      if (role === 'manager') return NextResponse.redirect(new URL('/manager', request.url))
      if (role === 'werkstudent') return NextResponse.redirect(new URL('/dashboard', request.url))
      return NextResponse.redirect(new URL('/pending', request.url))
    }
    return supabaseResponse
  }

  // Users without a role go to /pending
  if (!role && !isAdmin) {
    if (pathname === '/pending') return supabaseResponse
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  if (pathname === '/pending') {
    if (role === 'manager') return NextResponse.redirect(new URL('/manager', request.url))
    if (isAdmin) return NextResponse.redirect(new URL('/admin', request.url))
    if (role === 'werkstudent') return NextResponse.redirect(new URL('/dashboard', request.url))
    return supabaseResponse
  }

  // Cross-role route guards
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
