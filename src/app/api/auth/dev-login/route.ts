// DEV-ONLY: Guarded by DEV_LOGIN_ENABLED=true (set in Vercel env vars to enable on production)
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEV_PASSWORD = 'dev-login-2026'

export async function POST(req: NextRequest) {
  if (process.env.DEV_LOGIN_ENABLED !== 'true') {
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

  // Ensure the dev password is set (idempotent — safe to call on every login)
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
    password: DEV_PASSWORD,
  })

  if (updateError) {
    return NextResponse.json({ error: 'Session-Erzeugung fehlgeschlagen' }, { status: 500 })
  }

  // Sign in server-side so session cookies are set on the response — this avoids
  // any dependency on NEXT_PUBLIC_ env vars being correctly baked into the browser bundle.
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    return NextResponse.json(
      { error: signInError?.message ?? 'Login fehlgeschlagen' },
      { status: 500 }
    )
  }

  const redirectTo = profile.role === 'manager' ? '/manager' : '/dashboard'
  const response = NextResponse.json({ redirectTo })

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  return response
}
