'use server'

import { createClient } from '@/lib/supabase-server'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type { Profile, PlannedEntry, ActualEntry, AbsenceWithType } from '@/lib/database.types'

export interface KalenderWeekData {
  profiles: Profile[]
  planned: PlannedEntry[]
  actual: ActualEntry[]
  absences: AbsenceWithType[]
}

export async function loadKalenderWeek(
  weekStr: string,
  bereichFilter?: string | null
): Promise<{ data?: KalenderWeekData; error?: string }> {
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

  // Determine which user IDs to load based on bereich access
  let profileQuery = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'werkstudent')
    .eq('is_active', true)
    .order('full_name')

  if (currentProfile?.is_admin) {
    // Admin: optional bereich filter
    if (bereichFilter) {
      profileQuery = profileQuery.eq('bereich_id', bereichFilter)
    }
  } else {
    // Manager: filter to own bereiche only
    const { data: assignments } = await supabase
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    if (!assignments?.length) {
      return {
        data: { profiles: [], planned: [], actual: [], absences: [] },
      }
    }

    const managerBereichIds = assignments.map((a) => a.bereich_id)
    profileQuery = profileQuery.in('bereich_id', managerBereichIds)
  }

  const profilesResult = await profileQuery

  if (profilesResult.error) return { error: profilesResult.error.message }

  const profiles = (profilesResult.data ?? []) as Profile[]
  const userIds = profiles.map((p) => p.id)

  if (userIds.length === 0) {
    return { data: { profiles: [], planned: [], actual: [], absences: [] } }
  }

  const [plannedResult, actualResult] = await Promise.all([
    supabase
      .from('planned_entries')
      .select('*, arbeitsort:arbeitsorte(id, name, is_active)')
      .in('date', dates)
      .in('user_id', userIds),
    supabase.from('actual_entries').select('*').in('date', dates).in('user_id', userIds),
  ])

  let absencesData: AbsenceWithType[] = []
  try {
    const absencesResult = await supabase
      .from('absences')
      .select(
        '*, absence_type:absence_types(id, name, color, abbreviation), absence_type_override:absence_type_overrides(id, name, color, abbreviation)'
      )
      .in('date', dates)
      .in('user_id', userIds)
    if (!absencesResult.error) {
      absencesData = (absencesResult.data ?? []) as AbsenceWithType[]
    }
  } catch {
    absencesData = []
  }

  if (plannedResult.error) return { error: plannedResult.error.message }
  if (actualResult.error) return { error: actualResult.error.message }

  return {
    data: {
      profiles,
      planned: (plannedResult.data ?? []) as PlannedEntry[],
      actual: (actualResult.data ?? []) as ActualEntry[],
      absences: absencesData,
    },
  }
}
