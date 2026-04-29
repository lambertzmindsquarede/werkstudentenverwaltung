'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getWeekDates, getPreviousWeek, dateToString } from '@/lib/week-utils'
import { validateBlocks } from '@/lib/time-block-utils'

export type DayEntry = {
  date: string
  planned_start: string | null
  planned_end: string | null
  block_index: number
}

const DayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_start: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  planned_end: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  block_index: z.number().int().min(1).max(3),
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
    .select('date, planned_start, planned_end, block_index')
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

  const toInsert = parsed.data
    .filter((e) => e.planned_start && e.planned_end)
    .map((e) => ({
      user_id: user.id,
      date: e.date,
      planned_start: e.planned_start!,
      planned_end: e.planned_end!,
      block_index: e.block_index,
      updated_at: new Date().toISOString(),
    }))

  // Delete all entries for the week, then re-insert active blocks
  const { error: deleteError } = await supabase
    .from('planned_entries')
    .delete()
    .eq('user_id', user.id)
    .in('date', weekDates)
  if (deleteError) return { error: deleteError.message }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('planned_entries').insert(toInsert)
    if (insertError) return { error: insertError.message }
  }

  revalidatePath('/dashboard/wochenplanung')
  return {}
}

export async function loadPreviousWeekTemplate(
  weekStr: string
): Promise<{ data?: DayEntry[]; error?: string }> {
  return loadWeekEntries(getPreviousWeek(weekStr))
}
