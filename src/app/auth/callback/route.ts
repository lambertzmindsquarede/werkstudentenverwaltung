import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withCleanSession } from '@/lib/session-cleaner'

// Decode a JWT payload without verifying the signature.
// The signature was already verified by Azure AD during code exchange.
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1]
    return JSON.parse(Buffer.from(base64, 'base64url').toString('utf-8'))
  } catch {
    return {}
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll: withCleanSession((cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        }),
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const user = data.session.user

  // Determine admin status from the Azure AD access token groups claim.
  // Azure AD includes group object IDs in the `groups` claim when configured.
  const adminGroupId = process.env.ENTRA_ADMIN_GROUP_ID
  let isAdmin = false

  if (adminGroupId && data.session.provider_token) {
    const payload = decodeJwtPayload(data.session.provider_token)
    const groups = Array.isArray(payload.groups) ? payload.groups : []
    isAdmin = groups.includes(adminGroupId)
  }

  // Re-set the session without provider_token / provider_refresh_token.
  // Azure AD tokens can be several KB; keeping them in cookies causes
  // Vercel's 494 REQUEST_HEADER_TOO_LARGE error. The provider_token was
  // only needed above to check group membership — it is not needed again.
  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })

  // Upsert profile on every login so name/email stays fresh and is_admin is re-evaluated.
  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      is_admin: isAdmin,
    },
    { onConflict: 'id' }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  const admin = profile?.is_admin ?? false

  // Manager role takes priority over admin-only redirect
  if (role === 'manager') {
    return NextResponse.redirect(`${origin}/manager`)
  }

  if (admin) {
    return NextResponse.redirect(`${origin}/admin`)
  }

  if (role === 'werkstudent') {
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  return NextResponse.redirect(`${origin}/pending`)
}
