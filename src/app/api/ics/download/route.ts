import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import { generateIcs, type IcsEntry } from '@/lib/ics-generator'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager' && !profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const weekStr = searchParams.get('week')
  const bereichFilter = searchParams.get('bereich') ?? null

  if (!weekStr || !/^\d{4}-W\d{2}$/.test(weekStr)) {
    return NextResponse.json({ error: 'Invalid week' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()
  const weekDates = getWeekDates(weekStr).map(dateToString)

  // Determine which bereiche this user may access
  let allowedBereichIds: string[] | null = null // null = admin sees all
  if (!profile?.is_admin) {
    const { data: bm } = await supabaseAdmin
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)
    allowedBereichIds = (bm ?? []).map((b) => b.bereich_id)
  }

  // If a bereich filter is requested, verify the user is allowed to access it
  if (bereichFilter && allowedBereichIds !== null && !allowedBereichIds.includes(bereichFilter)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Load werkstudenten visible to this manager (filtered by bereich if provided)
  let profilesQuery = supabaseAdmin
    .from('profiles')
    .select('id, full_name, bereich_id')
    .eq('role', 'werkstudent')
    .eq('is_active', true)

  if (bereichFilter) {
    profilesQuery = profilesQuery.eq('bereich_id', bereichFilter)
  } else if (allowedBereichIds !== null) {
    if (allowedBereichIds.length === 0) {
      return new NextResponse(buildEmptyIcs(), {
        headers: icsHeaders(weekStr),
      })
    }
    profilesQuery = profilesQuery.in('bereich_id', allowedBereichIds)
  }

  const { data: werkstudenten } = await profilesQuery

  if (!werkstudenten || werkstudenten.length === 0) {
    return new NextResponse(buildEmptyIcs(), {
      headers: icsHeaders(weekStr),
    })
  }

  const userIds = werkstudenten.map((w) => w.id)

  // Load planned entries for the week
  const { data: planned } = await supabaseAdmin
    .from('planned_entries')
    .select('user_id, date, planned_start, planned_end, block_index')
    .in('user_id', userIds)
    .in('date', weekDates)

  // Load sequences
  const { data: sequences } = await supabaseAdmin
    .from('ics_event_sequences')
    .select('user_id, date, sequence')
    .in('user_id', userIds)
    .in('date', weekDates)

  const sequenceMap = new Map<string, number>()
  for (const s of sequences ?? []) {
    sequenceMap.set(`${s.user_id}|${s.date}`, s.sequence)
  }

  const profileMap = new Map(werkstudenten.map((w) => [w.id, w.full_name ?? w.id]))

  const entries: IcsEntry[] = (planned ?? []).map((p) => {
    const seq = sequenceMap.get(`${p.user_id}|${p.date}`) ?? 0
    const start = p.planned_start?.substring(0, 5) ?? '00:00'
    const end = p.planned_end?.substring(0, 5) ?? '00:00'
    return {
      userId: p.user_id,
      date: p.date,
      fullName: profileMap.get(p.user_id) ?? p.user_id,
      plannedStart: start,
      plannedEnd: end,
      sequence: seq,
      cancel: false,
    }
  })

  const icsContent = generateIcs(entries)

  return new NextResponse(icsContent, {
    headers: icsHeaders(weekStr),
  })
}

function buildEmptyIcs(): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Werkstudentenverwaltung//DE',
    'END:VCALENDAR',
  ].join('\r\n')
}

function icsHeaders(weekStr: string): Record<string, string> {
  const kw = weekStr.replace(/^(\d{4})-W(\d+)$/, 'kw$2-$1')
  return {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="wochenplan-${kw}.ics"`,
    'Cache-Control': 'no-store',
  }
}
