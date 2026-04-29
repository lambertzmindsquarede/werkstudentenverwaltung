// DEV-ONLY: Double-guarded by NODE_ENV=development AND DEV_LOGIN_ENABLED=true
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.DEV_LOGIN_ENABLED !== 'true'
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role')
    .eq('is_active', true)
    .eq('role', 'manager')
    .limit(1)
    .single()

  if (profileError || !profile?.email) {
    return NextResponse.json(
      { error: 'Dev-Admin-User nicht gefunden' },
      { status: 404 }
    )
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    const msg = linkError?.message?.toLowerCase() ?? ''
    if (msg.includes('user not found') || msg.includes('not found')) {
      return NextResponse.json(
        { error: 'Dev-Admin-User nicht gefunden' },
        { status: 404 }
      )
    }
    return NextResponse.json({ error: 'Session-Erzeugung fehlgeschlagen' }, { status: 500 })
  }

  const redirectTo = profile.role === 'manager' ? '/manager' : '/dashboard'
  return NextResponse.json({
    tokenHash: linkData.properties.hashed_token,
    redirectTo,
  })
}
