'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getWeekDates, getPreviousWeek, dateToString } from '@/lib/week-utils'

export type DayEntry = {
  date: string
  planned_start: string | null
  planned_end: string | null
}

const DayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_start: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  planned_end: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
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
    .select('date, planned_start, planned_end')
    .eq('user_id', user.id)
    .in('date', dates)
    .limit(7)

  if (error) return { error: error.message }

  const normalized: DayEntry[] = (data ?? []).map((row) => ({
    date: row.date,
    planned_start: row.planned_start ? normalizeTime(row.planned_start) : null,
    planned_end: row.planned_end ? normalizeTime(row.planned_end) : null,
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

  const toUpsert = parsed.data
    .filter((e) => e.planned_start && e.planned_end)
    .map((e) => ({
      user_id: user.id,
      date: e.date,
      planned_start: e.planned_start!,
      planned_end: e.planned_end!,
      updated_at: new Date().toISOString(),
    }))

  const activeDates = new Set(toUpsert.map((e) => e.date))
  const toDelete = weekDates.filter((d) => !activeDates.has(d))

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('planned_entries')
      .upsert(toUpsert, { onConflict: 'user_id,date' })
    if (error) return { error: error.message }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('planned_entries')
      .delete()
      .eq('user_id', user.id)
      .in('date', toDelete)
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/wochenplanung')
  return {}
}

export async function loadPreviousWeekTemplate(
  weekStr: string
): Promise<{ data?: DayEntry[]; error?: string }> {
  return loadWeekEntries(getPreviousWeek(weekStr))
}
