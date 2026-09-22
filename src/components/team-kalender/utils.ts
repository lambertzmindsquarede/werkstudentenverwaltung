import type { PlannedEntry } from '@/lib/database.types'
import { calcBlockHours } from '@/lib/time-block-utils'
import type { TeamKalenderMember } from '@/app/dashboard/team-kalender/actions'

export function formatHours(hours: number): string {
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`
}

/** Kompaktes Label für die Plan-Blöcke eines Tages (analog zur Manager-Zelle). */
export function getPlanLabel(plans: PlannedEntry[]): { label: string | null; hours: number } {
  const hours = plans.reduce((s, p) => s + calcBlockHours(p.planned_start, p.planned_end), 0)

  if (plans.length === 1) {
    const start = plans[0].planned_start?.substring(0, 5)
    const end = plans[0].planned_end?.substring(0, 5)
    if (start && end) return { label: `${start} – ${end}`, hours }
  }
  if (plans.length > 1 && hours > 0) {
    return { label: `${plans.length} Bl. · ${formatHours(hours)}`, hours }
  }
  return { label: null, hours }
}

/** Eigene Zeile zuerst, danach die vom Server gelieferte (alphabetische) Reihenfolge. */
export function sortMembersOwnFirst(
  members: TeamKalenderMember[],
  ownId: string
): TeamKalenderMember[] {
  return [...members].sort((a, b) => {
    if (a.id === ownId) return -1
    if (b.id === ownId) return 1
    return 0
  })
}

/** Initialen für den Avatar-Badge, z. B. „Max Mustermann" → „MM". */
export function getInitials(fullName: string | null): string {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}
