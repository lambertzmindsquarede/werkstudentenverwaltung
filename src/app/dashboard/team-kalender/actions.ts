'use server'

import type { PlannedEntry, AbsenceWithType } from '@/lib/database.types'

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
  _weekStr: string
): Promise<{ data?: TeamKalenderWeekData; error?: string }> {
  // TODO(PROJ-28 /backend): Implementierung folgt im Backend-Schritt —
  // Auth-Check (aktiver Werkstudent), Bereichs-Scoping, Service-Role-Reads,
  // Wochen-Clamp auf aktuelle/zukünftige KW.
  return {
    error: 'Der Team-Kalender ist noch nicht angebunden — die Daten folgen mit dem Backend-Schritt.',
  }
}
