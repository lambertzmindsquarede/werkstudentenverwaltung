'use server'

import { createClient } from '@/lib/supabase-server'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type { Profile, PlannedEntry, ActualEntry } from '@/lib/database.types'

export interface KalenderWeekData {
  profiles: Profile[]
  planned: PlannedEntry[]
  actual: ActualEntry[]
}

export async function loadKalenderWeek(
  weekStr: string
): Promise<{ data?: KalenderWeekData; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'manager') return { error: 'Zugriff verweigert' }

  const dates = getWeekDates(weekStr).map(dateToString)

  const [profilesResult, plannedResult, actualResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'werkstudent')
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('planned_entries').select('*').in('date', dates),
    supabase.from('actual_entries').select('*').in('date', dates),
  ])

  if (profilesResult.error) return { error: profilesResult.error.message }
  if (plannedResult.error) return { error: plannedResult.error.message }
  if (actualResult.error) return { error: actualResult.error.message }

  return {
    data: {
      profiles: (profilesResult.data ?? []) as Profile[],
      planned: (plannedResult.data ?? []) as PlannedEntry[],
      actual: (actualResult.data ?? []) as ActualEntry[],
    },
  }
}
