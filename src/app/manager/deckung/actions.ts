'use server'

import { createClient } from '@/lib/supabase-server'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type { Profile, PlannedEntry } from '@/lib/database.types'

export interface DeckungWeekData {
  profiles: Profile[]
  planned: PlannedEntry[]
}

export async function loadDeckungWeek(
  weekStr: string,
  bereichFilter?: string | null
): Promise<{ data?: DeckungWeekData; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'manager' && !currentProfile?.is_admin) {
    return { error: 'Zugriff verweigert' }
  }

  const dates = getWeekDates(weekStr).map(dateToString)

  let profileQuery = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'werkstudent')
    .eq('is_active', true)
    .order('full_name')

  if (currentProfile?.is_admin) {
    if (bereichFilter) {
      profileQuery = profileQuery.eq('bereich_id', bereichFilter)
    }
  } else {
    const { data: assignments } = await supabase
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    if (!assignments?.length) {
      return { data: { profiles: [], planned: [] } }
    }

    const managerBereichIds = assignments.map((a) => a.bereich_id)
    profileQuery = profileQuery.in('bereich_id', managerBereichIds)
  }

  const profilesResult = await profileQuery
  if (profilesResult.error) return { error: profilesResult.error.message }

  const profiles = (profilesResult.data ?? []) as Profile[]
  const userIds = profiles.map((p) => p.id)

  if (userIds.length === 0) {
    return { data: { profiles: [], planned: [] } }
  }

  const plannedResult = await supabase
    .from('planned_entries')
    .select('*')
    .in('date', dates)
    .in('user_id', userIds)

  if (plannedResult.error) return { error: plannedResult.error.message }

  return {
    data: {
      profiles,
      planned: (plannedResult.data ?? []) as PlannedEntry[],
    },
  }
}
