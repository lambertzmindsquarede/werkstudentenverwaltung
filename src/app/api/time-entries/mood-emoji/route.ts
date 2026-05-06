import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const isValidEmoji = (v: unknown): boolean =>
    typeof v === 'string' && v.length >= 1 && v.length <= 10 && /\P{ASCII}/u.test(v)

  const emoji =
    body.emoji === null
      ? null
      : isValidEmoji(body.emoji)
        ? (body.emoji as string)
        : undefined

  if (emoji === undefined) {
    return NextResponse.json({ error: 'Ungültiges Emoji.' }, { status: 400 })
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())

  const { data, error } = await supabase
    .from('actual_entries')
    .update({ mood_emoji: emoji })
    .eq('user_id', user.id)
    .eq('date', today)
    .eq('is_complete', false)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Kein offener Einstempel für heute gefunden.' },
      { status: 404 }
    )
  }
  return NextResponse.json({ data })
}
