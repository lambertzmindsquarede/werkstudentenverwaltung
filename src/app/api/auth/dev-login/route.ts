// DEV-ONLY: Double-guarded by NODE_ENV=development AND DEV_LOGIN_ENABLED=true
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
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

  let userId: string | null = null
  try {
    const body = await req.json()
    if (body.userId !== undefined) {
      if (typeof body.userId !== 'string' || !UUID_REGEX.test(body.userId)) {
        return NextResponse.json(
          { error: 'Ungültige userId (kein gültiges UUID-Format)' },
          { status: 400 }
        )
      }
      userId = body.userId
    }
  } catch {
    // no body or invalid JSON → treat as no userId provided
  }

  let profile: { id: string; email: string; role: string } | null = null

  if (userId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'User nicht gefunden — bitte Seed-Script ausführen (docs/dev-seed.sql)' },
        { status: 404 }
      )
    }

    if (!data.is_active) {
      return NextResponse.json({ error: 'Inaktiver User' }, { status: 403 })
    }

    if (!data.email) {
      return NextResponse.json(
        { error: 'User hat keine E-Mail-Adresse' },
        { status: 404 }
      )
    }

    profile = { id: data.id, email: data.email, role: data.role ?? 'werkstudent' }
  } else {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('is_active', true)
      .eq('role', 'manager')
      .limit(1)
      .single()

    if (error || !data?.email) {
      return NextResponse.json(
        { error: 'Dev-Admin-User nicht gefunden' },
        { status: 404 }
      )
    }

    profile = data
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    const msg = linkError?.message?.toLowerCase() ?? ''
    if (msg.includes('user not found') || msg.includes('not found')) {
      return NextResponse.json(
        { error: 'User nicht gefunden — bitte Seed-Script ausführen (docs/dev-seed.sql)' },
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
