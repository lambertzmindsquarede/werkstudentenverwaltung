'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getWeekDates, getPreviousWeek, dateToString } from '@/lib/week-utils'
import { validateBlocks } from '@/lib/time-block-utils'
import { getHolidayDates } from '@/lib/feiertage-server'
import { triggerIcsSend } from '@/lib/ics-sender'
import type { Arbeitsort } from '@/lib/database.types'

export type DayEntry = {
  date: string
  planned_start: string | null
  planned_end: string | null
  block_index: number
  arbeitsort_id?: string | null
}

const QUARTER_MINUTES = new Set([0, 15, 30, 45])

const QuarterHourTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .refine((t) => QUARTER_MINUTES.has(parseInt(t.split(':')[1], 10)), {
    message: 'Zeiten müssen auf Viertelstunden fallen (0, 15, 30 oder 45 Minuten)',
  })

const DayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_start: QuarterHourTime.nullable(),
  planned_end: QuarterHourTime.nullable(),
  block_index: z.number().int().min(1).max(3),
  arbeitsort_id: z.string().uuid().nullable().optional(),
})

function normalizeTime(time: string): string {
  return time.substring(0, 5)
}

export async function loadWeekEntries(
  weekStr: string
): Promise<{ data?: DayEntry[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const dates = getWeekDates(weekStr).map(dateToString)

  const { data, error } = await supabase
    .from('planned_entries')
    .select('date, planned_start, planned_end, block_index, arbeitsort_id')
    .eq('user_id', user.id)
    .in('date', dates)
    .order('date', { ascending: true })
    .order('block_index', { ascending: true })
    .limit(15)

  if (error) return { error: error.message }

  const normalized: DayEntry[] = (data ?? []).map((row) => ({
    date: row.date,
    planned_start: row.planned_start ? normalizeTime(row.planned_start) : null,
    planned_end: row.planned_end ? normalizeTime(row.planned_end) : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    block_index: (row as any).block_index ?? 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arbeitsort_id: (row as any).arbeitsort_id ?? null,
  }))

  return { data: normalized }
}

export async function saveWeekPlan(
  weekStr: string,
  entries: DayEntry[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const parsed = z.array(DayEntrySchema).safeParse(entries)
  if (!parsed.success) return { error: 'Ungültige Eingabe' }

  const weekDates = getWeekDates(weekStr).map(dateToString)

  // Server-side validation: group by date and check each day's blocks
  const byDate = new Map<string, { start: string; end: string }[]>()
  for (const e of parsed.data) {
    if (!e.planned_start || !e.planned_end) continue
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date)!.push({ start: e.planned_start, end: e.planned_end })
  }
  for (const [, blocks] of byDate) {
    const errors = validateBlocks(blocks)
    if (errors.length > 0) return { error: errors[0].message }
  }

  const todayStr = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })
  const editableDates = weekDates.filter((d) => d >= todayStr)

  const toInsert = parsed.data
    .filter((e) => e.planned_start && e.planned_end && e.date >= todayStr)
    .map((e) => ({
      user_id: user.id,
      date: e.date,
      planned_start: e.planned_start!,
      planned_end: e.planned_end!,
      block_index: e.block_index,
      arbeitsort_id: e.arbeitsort_id ?? null,
      updated_at: new Date().toISOString(),
    }))

  if (editableDates.length === 0) return {}

  // Server-side holiday check
  if (toInsert.length > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('bundesland')
      .eq('id', user.id)
      .single()
    const bl = profile?.bundesland ?? 'NW'
    const years = [...new Set(toInsert.map((e) => parseInt(e.date.slice(0, 4), 10)))]
    const holidayDates = await getHolidayDates(bl, years)
    const blocked = toInsert.find((e) => holidayDates.has(e.date))
    if (blocked) {
      return { error: 'Planung nicht möglich: Mindestens ein ausgewählter Tag ist ein gesetzlicher Feiertag.' }
    }
  }

  // Only delete/re-insert entries for non-past dates (preserve history)
  const { error: deleteError } = await supabase
    .from('planned_entries')
    .delete()
    .eq('user_id', user.id)
    .in('date', editableDates)
  if (deleteError) return { error: deleteError.message }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('planned_entries').insert(toInsert)
    if (insertError) return { error: insertError.message }
  }

  revalidatePath('/dashboard/wochenplanung')

  // Fire-and-forget ICS send — must not block the response
  const { data: profileForIcs } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const icsEntries = toInsert.map((e) => ({
    date: e.date,
    plannedStart: e.planned_start,
    plannedEnd: e.planned_end,
  }))

  void triggerIcsSend({
    userId: user.id,
    weekStr,
    currentEntries: icsEntries,
    fullName: profileForIcs?.full_name ?? user.email ?? user.id,
  })

  return {}
}

export async function loadPreviousWeekTemplate(
  weekStr: string
): Promise<{ data?: DayEntry[]; error?: string }> {
  return loadWeekEntries(getPreviousWeek(weekStr))
}

export async function getArbeitsorteForWerkstudent(): Promise<{ data?: Arbeitsort[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('manager_id')
    .eq('id', user.id)
    .single()

  if (!profile?.manager_id) return { data: [] }

  const { data, error } = await supabase
    .from('arbeitsorte')
    .select('*')
    .eq('manager_id', profile.manager_id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return { error: error.message }
  return { data: (data ?? []) as Arbeitsort[] }
}

export async function getLastUsedArbeitsortId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('planned_entries')
    .select('arbeitsort_id')
    .eq('user_id', user.id)
    .not('arbeitsort_id', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.arbeitsort_id ?? null
}
