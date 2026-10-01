import type { AbsenceWithType } from '@/lib/database.types'

// PROJ-28: Pure Logik der Team-Kalender-Action — separat, damit sie
// unit-testbar ist ('use server'-Dateien dürfen nur async exportieren).

const WEEK_REGEX = /^\d{4}-W\d{2}$/

/**
 * Zeithorizont-Clamp: ungültige oder vergangene Wochen → aktuelle KW.
 * ISO-Wochen-Strings (YYYY-W##, zero-padded) sind lexikographisch vergleichbar.
 */
export function clampWeek(requestedWeek: string, currentWeek: string): string {
  if (!WEEK_REGEX.test(requestedWeek)) return currentWeek
  return requestedWeek < currentWeek ? currentWeek : requestedWeek
}

/**
 * Beschneidet Abwesenheiten für die Antwort an Werkstudenten:
 * Kollegen-Abwesenheiten werden auf user_id + Datum reduziert (kein Typ,
 * keine Notiz, keine IDs); nur die eigenen behalten den vollen Datensatz.
 */
export function trimAbsences(
  absences: AbsenceWithType[],
  ownUserId: string
): {
  teamAbsences: { user_id: string; date: string }[]
  ownAbsences: AbsenceWithType[]
} {
  return {
    teamAbsences: absences.map((a) => ({ user_id: a.user_id, date: a.date })),
    ownAbsences: absences.filter((a) => a.user_id === ownUserId),
  }
}
