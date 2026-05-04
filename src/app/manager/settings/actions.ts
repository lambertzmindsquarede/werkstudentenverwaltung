'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { error?: string }

export async function saveMaxEditDaysPast(days: number): Promise<ActionResult> {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return { error: 'Bitte einen Wert zwischen 1 und 365 eingeben.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager') return { error: 'Keine Berechtigung' }

  const { error } = await supabase.from('app_settings').upsert({
    key: 'max_edit_days_past',
    value: String(days),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/manager/settings')
  return {}
}
