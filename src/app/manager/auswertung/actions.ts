'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
  format,
  getISOWeek,
  getISOWeekYear,
  isWeekend,
  parseISO,
} from 'date-fns'

export interface TagDetail {
  date: string
  weekday: string
  planStart: string | null
  planEnd: string | null
  istStart: string | null
  istEnd: string | null
  nettoMinutes: number
  diffMinutes: number | null
  isUngeplant: boolean
}

export interface WerkstudentAuswertung {
  userId: string
  fullName: string
  weeklyHourLimit: number | null
  geplanteMinutes: number
  istMinutes: number
  diffMinutes: number
  auslastungProzent: number | null
  limitUeberschritten: boolean
  tage: TagDetail[]
}

export type DateRange =
  | { type: 'current-month' }
  | { type: 'last-month' }
  | { type: 'last-3-months' }
  | { type: 'month'; year: number; month: number }

export interface AuswertungResult {
  werkstudenten: WerkstudentAuswertung[]
  bereiche: { id: string; name: string }[]
  error?: string
}

function parseDateRange(range: DateRange): { start: Date; end: Date } {
  const now = new Date()
  if (range.type === 'current-month') {
    return { start: startOfMonth(now), end: endOfMonth(now) }
  }
  if (range.type === 'last-month') {
    const prev = subMonths(now, 1)
    return { start: startOfMonth(prev), end: endOfMonth(prev) }
  }
  if (range.type === 'last-3-months') {
    const threeMonthsAgo = subMonths(now, 3)
    return { start: startOfMonth(threeMonthsAgo), end: endOfMonth(now) }
  }
  const d = new Date(range.year, range.month - 1, 1)
  return { start: startOfMonth(d), end: endOfMonth(d) }
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToHHMM(m: number): string {
  const h = Math.floor(Math.abs(m) / 60)
  const min = Math.abs(m) % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export async function getAuswertungDaten(
  range: DateRange,
  bereichId: string | 'all'
): Promise<AuswertungResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { werkstudenten: [], bereiche: [], error: 'Nicht authentifiziert' }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && !profile.is_admin)) {
    return { werkstudenten: [], bereiche: [], error: 'Keine Berechtigung' }
  }

  // Load manager's bereiche
  let managerBereiche: { id: string; name: string }[] = []
  if (profile.is_admin) {
    const { data } = await admin.from('bereiche').select('id, name').order('name')
    managerBereiche = data ?? []
  } else {
    const { data: assignments } = await admin
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    if (assignments?.length) {
      const ids = assignments.map((a) => a.bereich_id)
      const { data } = await admin.from('bereiche').select('id, name').in('id', ids).order('name')
      managerBereiche = data ?? []
    }
  }

  const bereichIds =
    bereichId === 'all'
      ? managerBereiche.map((b) => b.id)
      : managerBereiche.some((b) => b.id === bereichId)
        ? [bereichId]
        : []

  if (bereichIds.length === 0) {
    return { werkstudenten: [], bereiche: managerBereiche }
  }

  // Load werkstudenten in these bereiche
  const { data: werkstudenten } = await admin
    .from('profiles')
    .select('id, full_name, weekly_hour_limit, bereich_id')
    .in('bereich_id', bereichIds)
    .eq('role', 'werkstudent')
    .eq('is_active', true)
    .order('full_name')

  if (!werkstudenten?.length) {
    return { werkstudenten: [], bereiche: managerBereiche }
  }

  const { start, end } = parseDateRange(range)
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')
  const memberIds = werkstudenten.map((w) => w.id)

  const [{ data: plannedEntries }, { data: actualEntries }] = await Promise.all([
    admin
      .from('planned_entries')
      .select('user_id, date, planned_start, planned_end')
      .in('user_id', memberIds)
      .gte('date', startStr)
      .lte('date', endStr),
    admin
      .from('actual_entries')
      .select('user_id, date, actual_start, actual_end, break_minutes, block_index')
      .in('user_id', memberIds)
      .gte('date', startStr)
      .lte('date', endStr),
  ])

  // Group by user_id → date
  type PlanEntry = { planned_start: string; planned_end: string }
  type ActualEntry = { actual_start: string | null; actual_end: string | null; break_minutes: number; block_index: number | null }

  const planByUserDate = new Map<string, Map<string, PlanEntry[]>>()
  for (const pe of plannedEntries ?? []) {
    if (!planByUserDate.has(pe.user_id)) planByUserDate.set(pe.user_id, new Map())
    const byDate = planByUserDate.get(pe.user_id)!
    if (!byDate.has(pe.date)) byDate.set(pe.date, [])
    byDate.get(pe.date)!.push({ planned_start: pe.planned_start, planned_end: pe.planned_end })
  }

  const actualByUserDate = new Map<string, Map<string, ActualEntry[]>>()
  for (const ae of actualEntries ?? []) {
    if (!actualByUserDate.has(ae.user_id)) actualByUserDate.set(ae.user_id, new Map())
    const byDate = actualByUserDate.get(ae.user_id)!
    if (!byDate.has(ae.date)) byDate.set(ae.date, [])
    byDate.get(ae.date)!.push({
      actual_start: ae.actual_start,
      actual_end: ae.actual_end,
      break_minutes: ae.break_minutes ?? 0,
      block_index: ae.block_index,
    })
  }

  // All workdays in range (Mon–Fri)
  const allDays = eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d))

  const results: WerkstudentAuswertung[] = werkstudenten.map((ws) => {
    const planDates = planByUserDate.get(ws.id) ?? new Map()
    const actualDates = actualByUserDate.get(ws.id) ?? new Map()

    // Collect all relevant dates: planned or actual
    const relevantDates = new Set([...planDates.keys(), ...actualDates.keys()])

    // Also add weekend days if actual entries exist on them
    const weekendActualDates = [...actualDates.keys()].filter((d) => {
      const day = parseISO(d).getDay()
      return day === 0 || day === 6
    })

    const allRelevantDays = [
      ...allDays.filter((d) => relevantDates.has(format(d, 'yyyy-MM-dd'))),
      ...weekendActualDates.map((d) => parseISO(d)),
    ].sort((a, b) => a.getTime() - b.getTime())

    let geplanteMinutes = 0
    let istMinutes = 0

    // Weekly tracking for limit check
    const weeklyIstMinutes = new Map<string, number>()

    const tage: TagDetail[] = []

    for (const day of allRelevantDays) {
      const dateStr = format(day, 'yyyy-MM-dd')
      const plans = planDates.get(dateStr) ?? []
      const actuals = actualDates.get(dateStr) ?? []

      if (plans.length === 0 && actuals.length === 0) continue

      // Plan aggregation: sum all planned blocks
      let planMinutes = 0
      let planStart: string | null = null
      let planEnd: string | null = null
      if (plans.length > 0) {
        for (const p of plans) {
          planMinutes += timeToMinutes(p.planned_end) - timeToMinutes(p.planned_start)
        }
        planStart = plans.reduce(
          (min: string, p: PlanEntry) => (timeToMinutes(p.planned_start) < timeToMinutes(min) ? p.planned_start : min),
          plans[0].planned_start
        )
        planEnd = plans.reduce(
          (max: string, p: PlanEntry) => (timeToMinutes(p.planned_end) > timeToMinutes(max) ? p.planned_end : max),
          plans[0].planned_end
        )
      }

      // Actual aggregation: sum netto minutes, find earliest start / latest end
      let nettoMin = 0
      let istStart: string | null = null
      let istEnd: string | null = null
      if (actuals.length > 0) {
        for (const a of actuals) {
          if (a.actual_start && a.actual_end) {
            nettoMin += timeToMinutes(a.actual_end) - timeToMinutes(a.actual_start) - (a.break_minutes ?? 0)
          }
        }
        const withTimes = actuals.filter((a: ActualEntry) => a.actual_start && a.actual_end)
        if (withTimes.length > 0) {
          istStart = withTimes.reduce(
            (min: string, a: ActualEntry) => (timeToMinutes(a.actual_start!) < timeToMinutes(min) ? a.actual_start! : min),
            withTimes[0].actual_start!
          )
          istEnd = withTimes.reduce(
            (max: string, a: ActualEntry) => (timeToMinutes(a.actual_end!) > timeToMinutes(max) ? a.actual_end! : max),
            withTimes[0].actual_end!
          )
        }
      }

      geplanteMinutes += planMinutes
      istMinutes += Math.max(0, nettoMin)

      // Weekly bucket for limit check
      if (nettoMin > 0) {
        const weekKey = `${getISOWeekYear(day)}-W${String(getISOWeek(day)).padStart(2, '0')}`
        weeklyIstMinutes.set(weekKey, (weeklyIstMinutes.get(weekKey) ?? 0) + Math.max(0, nettoMin))
      }

      const isUngeplant = plans.length === 0 && actuals.length > 0
      const diffMin = plans.length > 0 && actuals.length > 0 ? nettoMin - planMinutes : null

      tage.push({
        date: dateStr,
        weekday: WEEKDAYS[day.getDay()],
        planStart,
        planEnd,
        istStart,
        istEnd,
        nettoMinutes: Math.max(0, nettoMin),
        diffMinutes: diffMin,
        isUngeplant,
      })
    }

    const diffMinutes = istMinutes - geplanteMinutes
    const auslastungProzent = geplanteMinutes > 0 ? Math.round((istMinutes / geplanteMinutes) * 100) : null

    // Check if weekly limit was exceeded in any week
    const limitMinutes = ws.weekly_hour_limit ? ws.weekly_hour_limit * 60 : null
    const limitUeberschritten = limitMinutes !== null
      ? [...weeklyIstMinutes.values()].some((m) => m > limitMinutes!)
      : false

    return {
      userId: ws.id,
      fullName: ws.full_name ?? '(Unbekannt)',
      weeklyHourLimit: ws.weekly_hour_limit,
      geplanteMinutes,
      istMinutes,
      diffMinutes,
      auslastungProzent,
      limitUeberschritten,
      tage,
    }
  })

  return { werkstudenten: results, bereiche: managerBereiche }
}

export async function getManagerBereiche(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, role')
    .eq('id', user.id)
    .single()

  if (!profile) return []

  if (profile.is_admin) {
    const { data } = await admin.from('bereiche').select('id, name').order('name')
    return data ?? []
  }

  if (profile.role === 'manager') {
    const { data: assignments } = await admin
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    if (!assignments?.length) return []

    const ids = assignments.map((a) => a.bereich_id)
    const { data } = await admin.from('bereiche').select('id, name').in('id', ids).order('name')
    return data ?? []
  }

  return []
}

