import { NextResponse } from 'next/server'
import { z } from 'zod'
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

function getBerlinHHMM(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  return `${parts.find(p => p.type === 'hour')!.value}:${parts.find(p => p.type === 'minute')!.value}`
}

const timeFieldSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Ungültiges Zeitformat (HH:MM erwartet).')
  .refine(
    (t) => parseInt(t.split(':')[1], 10) % 5 === 0,
    { message: 'Minuten müssen ein Vielfaches von 5 sein.' }
  )
  .optional()

const postBodySchema = z.object({
  emoji: z.string().min(1).max(10).optional(),
  time: timeFieldSchema,
})

const patchBodySchema = z.object({
  time: timeFieldSchema,
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await request.json().catch(() => ({}))
  const parsed = postBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })
  }
  const { emoji: rawEmoji, time: requestedTime } = parsed.data

  const emoji =
    typeof rawEmoji === 'string' && /\P{ASCII}/u.test(rawEmoji) ? rawEmoji : null

  const { date, time: serverTime } = getBerlinDateTime()

  // Validate custom time if provided
  if (requestedTime) {
    const nowHHMM = getBerlinHHMM()
    if (requestedTime > nowHHMM) {
      return NextResponse.json(
        { error: 'Zeit darf nicht in der Zukunft liegen.' },
        { status: 422 }
      )
    }
  }

  // Block stamp-in if absence is recorded for today
  const { data: todayAbsence } = await supabase
    .from('absences')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  if (todayAbsence) {
    return NextResponse.json(
      { error: 'Du bist heute als abwesend eingetragen. Einstempeln ist nicht möglich.' },
      { status: 409 }
    )
  }

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

  // Count today's blocks and validate against last block end
  const { data: todayBlocks, count } = await supabase
    .from('actual_entries')
    .select('actual_end', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('date', date)
    .eq('is_complete', true)
    .order('actual_start', { ascending: true })

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'Maximum 3 Blöcke pro Tag erreicht.' },
      { status: 409 }
    )
  }

  if (requestedTime && todayBlocks && todayBlocks.length > 0) {
    const lastEnd = todayBlocks[todayBlocks.length - 1].actual_end?.slice(0, 5)
    if (lastEnd && requestedTime <= lastEnd) {
      return NextResponse.json(
        { error: `Zeit muss nach ${lastEnd} Uhr liegen.` },
        { status: 422 }
      )
    }
  }

  const blockIndex = (count ?? 0) + 1
  const actualStart = requestedTime ? `${requestedTime}:00` : serverTime

  const { data, error } = await supabase
    .from('actual_entries')
    .insert({
      user_id: user.id,
      date,
      actual_start: actualStart,
      is_complete: false,
      block_index: blockIndex,
      mood_emoji: emoji,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await request.json().catch(() => ({}))
  const parsed = patchBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })
  }
  const { time: requestedTime } = parsed.data

  const { date, time: serverTime } = getBerlinDateTime()

  // Validate custom time if provided
  if (requestedTime) {
    const nowHHMM = getBerlinHHMM()
    if (requestedTime > nowHHMM) {
      return NextResponse.json(
        { error: 'Zeit darf nicht in der Zukunft liegen.' },
        { status: 422 }
      )
    }
  }

  // Fetch open block to validate timing
  const { data: openBlock } = await supabase
    .from('actual_entries')
    .select('id, actual_start')
    .eq('user_id', user.id)
    .eq('date', date)
    .eq('is_complete', false)
    .maybeSingle()

  if (!openBlock) {
    return NextResponse.json(
      { error: 'Kein offener Einstempel für heute gefunden.' },
      { status: 404 }
    )
  }

  if (requestedTime && openBlock.actual_start) {
    const startMins = timeToMinutes(openBlock.actual_start.slice(0, 5))
    const endMins = timeToMinutes(requestedTime)
    if (endMins - startMins < 1) {
      return NextResponse.json(
        { error: `Zeit muss mindestens 1 Minute nach ${openBlock.actual_start.slice(0, 5)} Uhr liegen.` },
        { status: 422 }
      )
    }
  }

  const actualEnd = requestedTime ? `${requestedTime}:00` : serverTime

  const { data, error } = await supabase
    .from('actual_entries')
    .update({ actual_end: actualEnd, is_complete: true, mood_emoji: null })
    .eq('id', openBlock.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Fehler beim Ausstempeln.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ data })
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
