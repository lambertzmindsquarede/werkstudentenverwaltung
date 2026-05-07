'use server'

import { createClient } from '@/lib/supabase-server'
import type { AbsenceWithType } from '@/lib/database.types'

export interface AbwesenheitFilter {
  userId?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  typeId?: string | null
}

export interface AbwesenheitRow extends AbsenceWithType {
  user_full_name: string | null
  user_email: string | null
}

export async function loadManagerAbsences(
  filter: AbwesenheitFilter = {}
): Promise<{ data: AbwesenheitRow[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Nicht authentifiziert' }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'manager' && !currentProfile?.is_admin) {
    return { data: [], error: 'Zugriff verweigert' }
  }

  // Determine accessible user IDs (only from bereiche with absences_enabled=true)
  let userIds: string[] | null = null

  if (!currentProfile?.is_admin) {
    const { data: assignments } = await supabase
      .from('bereich_manager')
      .select('bereich_id, bereiche(absences_enabled)')
      .eq('user_id', user.id)

    if (!assignments?.length) return { data: [] }

    type Assignment = { bereich_id: string; bereiche: { absences_enabled: boolean } | null }
    const enabledBereichIds = (assignments as unknown as Assignment[])
      .filter((a) => a.bereiche?.absences_enabled !== false)
      .map((a) => a.bereich_id)

    if (enabledBereichIds.length === 0) return { data: [] }

    const { data: werkstudenten } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'werkstudent')
      .in('bereich_id', enabledBereichIds)

    userIds = (werkstudenten ?? []).map((p) => p.id)
    if (userIds.length === 0) return { data: [] }
  }

  try {
    let query = supabase
      .from('absences')
      .select(
        '*, absence_type:absence_types(id, name, color, abbreviation), absence_type_override:absence_type_overrides(id, name, color, abbreviation), profile:profiles(full_name, email)'
      )
      .order('date', { ascending: false })

    if (userIds) {
      query = query.in('user_id', userIds)
    }
    if (filter.userId) {
      query = query.eq('user_id', filter.userId)
    }
    if (filter.dateFrom) {
      query = query.gte('date', filter.dateFrom)
    }
    if (filter.dateTo) {
      query = query.lte('date', filter.dateTo)
    }

    const { data, error } = await query

    if (error) return { data: [], error: error.message }

    const rows: AbwesenheitRow[] = (data ?? []).map((row: Record<string, unknown>) => {
      const profile = row.profile as { full_name: string | null; email: string | null } | null
      return {
        ...(row as unknown as AbsenceWithType),
        profile: undefined,
        user_full_name: profile?.full_name ?? null,
        user_email: profile?.email ?? null,
      }
    })

    return { data: rows }
  } catch {
    return { data: [], error: 'Tabelle noch nicht vorhanden' }
  }
}

export async function deleteAbsenceAsManager(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager' && !profile?.is_admin) {
    return { error: 'Keine Berechtigung' }
  }

  const { data: absence } = await supabase
    .from('absences')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!absence) return { error: 'Abwesenheit nicht gefunden' }

  if (!profile?.is_admin) {
    const { data: assignments } = await supabase
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    const bereichIds = (assignments ?? []).map((a) => a.bereich_id)

    const { data: werkstudentProfile } = await supabase
      .from('profiles')
      .select('bereich_id')
      .eq('id', absence.user_id)
      .single()

    if (
      !werkstudentProfile?.bereich_id ||
      !bereichIds.includes(werkstudentProfile.bereich_id)
    ) {
      return { error: 'Zugriff verweigert' }
    }
  }

  const { error } = await supabase.from('absences').delete().eq('id', id)
  if (error) return { error: error.message }

  return {}
}

export async function getWerkstudentsForManager(): Promise<
  { id: string; full_name: string | null; email: string | null }[]
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (currentProfile?.is_admin) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'werkstudent')
      .eq('is_active', true)
      .order('full_name')
    return (data ?? []) as { id: string; full_name: string | null; email: string | null }[]
  }

  const { data: assignments } = await supabase
    .from('bereich_manager')
    .select('bereich_id, bereiche(absences_enabled)')
    .eq('user_id', user.id)

  if (!assignments?.length) return []

  type Assignment = { bereich_id: string; bereiche: { absences_enabled: boolean } | null }
  const enabledBereichIds = (assignments as unknown as Assignment[])
    .filter((a) => a.bereiche?.absences_enabled !== false)
    .map((a) => a.bereich_id)

  if (enabledBereichIds.length === 0) return []

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'werkstudent')
    .eq('is_active', true)
    .in('bereich_id', enabledBereichIds)
    .order('full_name')

  return (data ?? []) as { id: string; full_name: string | null; email: string | null }[]
}

export async function getManagerDisabledAbsencesBereichCount(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.is_admin) {
    const { count } = await supabase
      .from('bereiche')
      .select('*', { count: 'exact', head: true })
      .eq('absences_enabled', false)
    return count ?? 0
  }

  const { data: assignments } = await supabase
    .from('bereich_manager')
    .select('bereich_id, bereiche(absences_enabled)')
    .eq('user_id', user.id)

  if (!assignments?.length) return 0

  type Assignment = { bereich_id: string; bereiche: { absences_enabled: boolean } | null }
  return (assignments as unknown as Assignment[]).filter(
    (a) => a.bereiche?.absences_enabled === false
  ).length
}
