'use server'

import { createClient } from '@/lib/supabase-server'
import { DEFAULT_MAX_EDIT_DAYS_PAST } from '@/lib/database.types'
import type { ActualEntry } from '@/lib/database.types'

async function assertEditPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'Nicht authentifiziert'

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Managers are always allowed to edit any entry
  if (profile?.role === 'manager') return null

  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'max_edit_days_past')
    .single()

  const maxDays = setting ? parseInt(setting.value, 10) : DEFAULT_MAX_EDIT_DAYS_PAST
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - maxDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  if (date < cutoffStr) {
    return `Dieser Eintrag liegt außerhalb der Bearbeitungsfrist von ${maxDays} Tagen.`
  }

  return null
}

export async function updateActualEntry(
  entryId: string,
  data: { date: string; actual_start: string; actual_end: string; break_minutes: number }
): Promise<{ error?: string; data?: ActualEntry }> {
  const supabase = await createClient()

  const permError = await assertEditPermission(supabase, data.date)
  if (permError) return { error: permError }

  const { data: updated, error } = await supabase
    .from('actual_entries')
    .update({
      actual_start: data.actual_start,
      actual_end: data.actual_end,
      is_complete: true,
      break_minutes: data.break_minutes,
    })
    .eq('id', entryId)
    .select()
    .single()

  if (error || !updated) return { error: error?.message ?? 'Speichern fehlgeschlagen.' }
  return { data: updated as unknown as ActualEntry }
}

export async function insertActualEntry(
  data: { date: string; actual_start: string; actual_end: string; break_minutes: number }
): Promise<{ error?: string; data?: ActualEntry }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const permError = await assertEditPermission(supabase, data.date)
  if (permError) return { error: permError }

  const { data: inserted, error } = await supabase
    .from('actual_entries')
    .insert({
      user_id: user.id,
      date: data.date,
      actual_start: data.actual_start,
      actual_end: data.actual_end,
      is_complete: true,
      break_minutes: data.break_minutes,
    })
    .select()
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Speichern fehlgeschlagen.' }
  return { data: inserted as unknown as ActualEntry }
}

export async function deleteActualEntry(
  entryId: string,
  date: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const permError = await assertEditPermission(supabase, date)
  if (permError) return { error: permError }

  const { error } = await supabase.from('actual_entries').delete().eq('id', entryId)
  if (error) return { error: error.message }
  return {}
}

export async function updateBreakMinutes(
  entryId: string,
  date: string,
  minutes: number
): Promise<{ error?: string; data?: ActualEntry }> {
  const supabase = await createClient()

  const permError = await assertEditPermission(supabase, date)
  if (permError) return { error: permError }

  const { data: updated, error } = await supabase
    .from('actual_entries')
    .update({ break_minutes: minutes })
    .eq('id', entryId)
    .select()
    .single()

  if (error || !updated) return { error: error?.message ?? 'Speichern fehlgeschlagen.' }
  return { data: updated as unknown as ActualEntry }
}
