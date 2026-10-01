'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCurrentISOWeek, getWeekDates, dateToString } from '@/lib/week-utils'
import type { PlannedEntry, AbsenceWithType } from '@/lib/database.types'
import { clampWeek, trimAbsences } from './logic'

// PROJ-28: Team-Wochenkalender für Werkstudenten.
//
// Datenvertrag zwischen Server und Client. Die Beschneidung passiert im
// Antwortformat selbst: Für Kollegen enthält die Antwort ausschließlich
// Plan-Einträge und ein neutrales „abwesend ja/nein" pro Tag — Ist-Zeiten
// und Abwesenheitstypen von Kollegen existieren in diesem Vertrag nicht.
// Nur die eigenen Abwesenheiten (ownAbsences) tragen den Typ.

export interface TeamKalenderMember {
  id: string
  full_name: string | null
  weekly_hours: number | null
  bundesland: string | null
}

export interface TeamKalenderWeekData {
  /** Vom Server bestätigte Woche — bei angefragter Vergangenheit die aktuelle KW. */
  weekStr: string
  /** Aktive Werkstudenten des eigenen Bereichs, alphabetisch sortiert. */
  members: TeamKalenderMember[]
  planned: PlannedEntry[]
  /** Neutrale Abwesenheiten aller Bereichs-Kollegen (ohne Typ). */
  teamAbsences: { user_id: string; date: string }[]
  /** Eigene Abwesenheiten mit Typ — nur für den eingeloggten Nutzer. */
  ownAbsences: AbsenceWithType[]
  /** true, wenn der Nutzer keinem Bereich zugeordnet ist. */
  noBereich: boolean
}

export async function loadTeamKalenderWeek(
  weekStr: string
): Promise<{ data?: TeamKalenderWeekData; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  // Service-Role-Zugriff erst NACH explizitem Autorisierungs-Check:
  // nur aktive Werkstudenten dürfen den Team-Kalender laden.
  const admin = createAdminClient()
  const { data: selfProfile } = await admin
    .from('profiles')
    .select('role, is_active, bereich_id')
    .eq('id', user.id)
    .single()

  if (!selfProfile || selfProfile.role !== 'werkstudent' || !selfProfile.is_active) {
    return { error: 'Zugriff verweigert' }
  }

  const effectiveWeek = clampWeek(weekStr, getCurrentISOWeek())

  if (!selfProfile.bereich_id) {
    return {
      data: {
        weekStr: effectiveWeek,
        members: [],
        planned: [],
        teamAbsences: [],
        ownAbsences: [],
        noBereich: true,
      },
    }
  }

  const { data: membersData, error: membersError } = await admin
    .from('profiles')
    .select('id, full_name, weekly_hour_limit, bundesland')
    .eq('bereich_id', selfProfile.bereich_id)
    .eq('role', 'werkstudent')
    .eq('is_active', true)
    .order('full_name')
    .limit(200)

  if (membersError) return { error: membersError.message }

  const members: TeamKalenderMember[] = (membersData ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    weekly_hours: p.weekly_hour_limit,
    bundesland: p.bundesland,
  }))

  const memberIds = members.map((m) => m.id)
  const dates = getWeekDates(effectiveWeek).map(dateToString)

  const [plannedResult, absencesResult] = await Promise.all([
    admin
      .from('planned_entries')
      .select('*, arbeitsort:arbeitsorte(id, name, is_active)')
      .in('user_id', memberIds)
      .in('date', dates)
      .limit(2000),
    admin
      .from('absences')
      .select(
        '*, absence_type:absence_types(id, name, color, abbreviation), absence_type_override:absence_type_overrides(id, name, color, abbreviation)'
      )
      .in('user_id', memberIds)
      .in('date', dates)
      .limit(1000),
  ])

  if (plannedResult.error) return { error: plannedResult.error.message }
  if (absencesResult.error) return { error: absencesResult.error.message }

  const absences = (absencesResult.data ?? []) as unknown as AbsenceWithType[]
  const { teamAbsences, ownAbsences } = trimAbsences(absences, user.id)

  return {
    data: {
      weekStr: effectiveWeek,
      members,
      planned: (plannedResult.data ?? []) as unknown as PlannedEntry[],
      teamAbsences,
      ownAbsences,
      noBereich: false,
    },
  }
}
