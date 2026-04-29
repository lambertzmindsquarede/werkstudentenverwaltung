import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

function getBerlinDateTime(): { date: string; time: string } {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  return { date, time }
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, time } = getBerlinDateTime()

  // Check for open block (must stamp out before stamping in again)
  const { data: openBlock } = await supabase
    .from('actual_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .eq('is_complete', false)
    .maybeSingle()

  if (openBlock) {
    return NextResponse.json({ error: 'Bitte zuerst ausstempeln.' }, { status: 409 })
  }

  // Count today's blocks
  const { count } = await supabase
    .from('actual_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('date', date)

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'Maximum 3 Blöcke pro Tag erreicht.' },
      { status: 409 }
    )
  }

  const blockIndex = (count ?? 0) + 1

  const { data, error } = await supabase
    .from('actual_entries')
    .insert({
      user_id: user.id,
      date,
      actual_start: time,
      is_complete: false,
      block_index: blockIndex,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, time } = getBerlinDateTime()

  const { data, error } = await supabase
    .from('actual_entries')
    .update({ actual_end: time, is_complete: true })
    .eq('user_id', user.id)
    .eq('date', date)
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
