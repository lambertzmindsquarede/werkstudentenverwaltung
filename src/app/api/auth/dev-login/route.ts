// DEV-ONLY: Guarded by DEV_LOGIN_ENABLED=true (set in Vercel env vars to enable on production)
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEV_PASSWORD = 'dev-login-2026'

// GET /api/auth/dev-login?userId=<uuid>
// Browser navigates here directly — server sets session cookies and redirects.
// No fetch/timing issues with cookie storage.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin

  if (process.env.DEV_LOGIN_ENABLED !== 'true') {
    return NextResponse.redirect(`${origin}/login`)
  }

  const rawUserId = req.nextUrl.searchParams.get('userId')

  if (!rawUserId || !UUID_REGEX.test(rawUserId)) {
    return NextResponse.redirect(`${origin}/login?error=dev_login_invalid_user`)
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, is_active')
    .eq('id', rawUserId)
    .single()

  if (profileError || !profileData?.email || !profileData.is_active) {
    return NextResponse.redirect(`${origin}/login?error=dev_login_user_not_found`)
  }

  const profile = {
    id: profileData.id as string,
    email: profileData.email as string,
    role: (profileData.role ?? 'werkstudent') as string,
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
    password: DEV_PASSWORD,
  })

  if (updateError) {
    return NextResponse.redirect(`${origin}/login?error=dev_login_failed`)
  }

  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            pendingCookies.push({ name, value, options: options as Record<string, unknown> })
          )
        },
      },
    }
  )

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: DEV_PASSWORD,
  })

  if (signInError || !signInData.session) {
    return NextResponse.redirect(`${origin}/login?error=dev_login_failed`)
  }

  const redirectTo = profile.role === 'manager' ? '/manager' : '/dashboard'
  const response = NextResponse.redirect(`${origin}${redirectTo}`)

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  return response
}
