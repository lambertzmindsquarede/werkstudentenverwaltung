import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { userId, from, to } = body as { userId?: string; from: string; to: string }

  const targetUserId = userId ?? user.id
  const adminClient = createAdminClient()

  if (targetUserId !== user.id) {
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'manager' && !callerProfile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!callerProfile?.is_admin) {
      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('bereich_id')
        .eq('id', targetUserId)
        .single()
      const { data: bm } = await adminClient
        .from('bereich_manager')
        .select('bereich_id')
        .eq('user_id', user.id)
      const managerBereichIds = (bm ?? []).map((b) => b.bereich_id)
      if (!targetProfile?.bereich_id || !managerBereichIds.includes(targetProfile.bereich_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  const { data: entries } = await adminClient
    .from('actual_entries')
    .select('date, actual_start, actual_end, break_minutes, block_index')
    .eq('user_id', targetUserId)
    .gte('date', from)
    .lte('date', to)
    .eq('is_complete', true)

  const byDate: Record<string, { actual_start: string; actual_end: string; break_minutes: number }[]> = {}
  for (const entry of entries ?? []) {
    if (!entry.actual_start || !entry.actual_end) continue
    if (!byDate[entry.date]) byDate[entry.date] = []
    byDate[entry.date].push({
      actual_start: entry.actual_start,
      actual_end: entry.actual_end,
      break_minutes: entry.break_minutes ?? 0,
    })
  }

  // Build monthly summaries
  const fromDate = new Date(from + 'T00:00:00')
  const toDate = new Date(to + 'T00:00:00')
  const months: { year: number; month: number }[] = []
  let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
  const toMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 1)
  while (cur <= toMonth) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }

  const result = months.map(({ year, month }) => {
    const mm = String(month).padStart(2, '0')
    const daysInMonth = new Date(year, month, 0).getDate()

    // Date range within this month
    const rangeFrom = from > `${year}-${mm}-01` ? from : `${year}-${mm}-01`
    const lastDay = String(daysInMonth).padStart(2, '0')
    const rangeTo = to < `${year}-${mm}-${lastDay}` ? to : `${year}-${mm}-${lastDay}`

    let daysWithData = 0
    let totalMinutes = 0
    const days: { date: string; dateLabel: string; startTime: string; endTime: string; breakMinutes: number; hours: number }[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${mm}-${String(day).padStart(2, '0')}`
      if (dateStr < rangeFrom || dateStr > rangeTo) continue

      const dayEntries = byDate[dateStr]
      if (!dayEntries || dayEntries.length === 0) continue

      daysWithData++
      const sorted = [...dayEntries].sort(
        (a, b) => timeToMinutes(a.actual_start) - timeToMinutes(b.actual_start)
      )
      const startMin = timeToMinutes(sorted[0].actual_start)
      const endMin = timeToMinutes(sorted[sorted.length - 1].actual_end)
      let pauseMin = sorted.reduce((sum, e) => sum + e.break_minutes, 0)
      for (let i = 1; i < sorted.length; i++) {
        const gapEnd = timeToMinutes(sorted[i].actual_start)
        const gapStart = timeToMinutes(sorted[i - 1].actual_end)
        if (gapEnd > gapStart) pauseMin += gapEnd - gapStart
      }
      const dayMinutes = endMin - startMin - pauseMin
      totalMinutes += dayMinutes

      const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(
        new Date(dateStr + 'T00:00:00')
      )
      days.push({
        date: dateStr,
        dateLabel: `${weekday}, ${String(day).padStart(2, '0')}.${mm}.`,
        startTime: sorted[0].actual_start.slice(0, 5),
        endTime: sorted[sorted.length - 1].actual_end.slice(0, 5),
        breakMinutes: pauseMin,
        hours: Math.round((dayMinutes / 60) * 10) / 10,
      })
    }

    const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1)
    )
    const rangeLabel = `${rangeFrom.split('-').reverse().slice(0,2).join('.')}.–${rangeTo.split('-').reverse().slice(0,2).join('.')}.`

    return {
      year,
      month,
      monthLabel,
      rangeLabel,
      daysWithData,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      hasData: daysWithData > 0,
      days,
    }
  })

  return NextResponse.json({ months: result })
}
