import type { PlannedEntry, AbsenceWithType } from '@/lib/database.types'
import { getAbsenceName, getAbsenceColor, getAbsenceAbbreviation } from '@/lib/database.types'
import { getPlanLabel, formatHours } from './utils'

interface Props {
  plans: PlannedEntry[]
  /** Kollege ist an diesem Tag abwesend (neutral, ohne Typ). */
  absent: boolean
  /** Eigene Abwesenheit mit Typ — nur in der eigenen Zeile gesetzt. */
  ownAbsence?: AbsenceWithType | null
  holidayName?: string | null
}

/**
 * Read-only-Tageszelle des Team-Wochenkalenders (PROJ-28).
 * Zeigt ausschließlich Plan-Daten — bewusst keine Ist-Zeiten und für
 * Kollegen keinen Abwesenheitstyp (nur neutrales „Abwesend"-Badge).
 */
export default function TeamKalenderZelle({ plans, absent, ownAbsence, holidayName }: Props) {
  const { label, hours } = getPlanLabel(plans)
  const arbeitsortName = plans[0]?.arbeitsort?.name ?? null
  const isEmpty = !label && !absent && !ownAbsence

  return (
    <div className="w-full h-full min-h-[72px] rounded-md px-2 py-1.5 bg-transparent">
      {isEmpty && !holidayName && <span className="text-slate-300 text-xs">—</span>}

      {label && (
        <div className="rounded-md bg-slate-100 px-2 py-1.5">
          <div className="text-xs font-medium text-slate-600">{label}</div>
          {hours > 0 && plans.length === 1 && (
            <div className="text-xs text-slate-400">{formatHours(hours)}</div>
          )}
          {arbeitsortName && (
            <div className="text-xs text-slate-500 truncate mt-0.5" title={arbeitsortName}>
              {arbeitsortName}
            </div>
          )}
        </div>
      )}

      {ownAbsence ? (
        <div
          className="mt-1 text-xs rounded px-1.5 py-0.5 font-medium text-white flex items-center gap-1 truncate"
          style={{ backgroundColor: getAbsenceColor(ownAbsence) }}
          title={getAbsenceName(ownAbsence)}
        >
          <span className="flex-shrink-0 font-bold">{getAbsenceAbbreviation(ownAbsence)}</span>
          <span className="truncate">{getAbsenceName(ownAbsence)}</span>
        </div>
      ) : (
        absent && (
          <div className="mt-1 text-xs rounded px-1.5 py-0.5 font-medium bg-slate-400 text-white truncate">
            Abwesend
          </div>
        )
      )}

      {holidayName && (
        <div className="mt-1 text-xs bg-amber-100 text-amber-700 rounded px-1 py-0.5 truncate font-medium">
          🗓 {holidayName}
        </div>
      )}
    </div>
  )
}
