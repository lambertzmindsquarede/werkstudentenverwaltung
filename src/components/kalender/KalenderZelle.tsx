import type { PlannedEntry, ActualEntry } from '@/lib/database.types'
import { calcBlockHours } from '@/lib/time-block-utils'

interface Props {
  plans: PlannedEntry[]
  actuals: ActualEntry[]
  date: string
  today: string
  holidayName?: string | null
  onClick: () => void
}

type CellStatus = 'empty' | 'plan-future' | 'plan-past' | 'actual-only' | 'both'

function getCellStatus(
  plans: PlannedEntry[],
  actuals: ActualEntry[],
  date: string,
  today: string
): CellStatus {
  const hasPlan = plans.length > 0
  const hasActual = actuals.length > 0
  const isPast = date < today
  if (!hasPlan && !hasActual) return 'empty'
  if (!hasPlan && hasActual) return 'actual-only'
  if (hasPlan && hasActual) return 'both'
  return isPast ? 'plan-past' : 'plan-future'
}

function normalizeTime(t: string | null): string | null {
  return t ? t.substring(0, 5) : null
}

const statusStyles: Record<CellStatus, string> = {
  empty: 'bg-transparent hover:bg-slate-50',
  'plan-future': 'bg-slate-100 hover:bg-slate-200',
  'plan-past': 'bg-red-50 hover:bg-red-100 border border-red-200',
  'actual-only': 'bg-orange-50 hover:bg-orange-100 border border-orange-200',
  both: 'bg-green-50 hover:bg-green-100 border border-green-200',
}

export default function KalenderZelle({ plans, actuals, date, today, holidayName, onClick }: Props) {
  const status = getCellStatus(plans, actuals, date, today)

  const planHours = plans.reduce((s, p) => s + calcBlockHours(p.planned_start, p.planned_end), 0)
  const actHours = actuals.reduce((s, a) => s + calcBlockHours(a.actual_start, a.actual_end), 0)
  const hasOpenBlock = actuals.some((a) => !a.is_complete)

  // For display: use first block's times when single, show total otherwise
  const firstPlan = plans[0] ?? null
  const firstActual = actuals[0] ?? null
  const planStart = normalizeTime(firstPlan?.planned_start ?? null)
  const planEnd = normalizeTime(firstPlan?.planned_end ?? null)
  const actStart = normalizeTime(firstActual?.actual_start ?? null)
  const actEnd = normalizeTime(firstActual?.actual_end ?? null)

  const planLabel =
    plans.length === 1 && planStart && planEnd
      ? `${planStart} – ${planEnd}`
      : planHours > 0
      ? `${plans.length} Bl. · ${planHours % 1 === 0 ? planHours : planHours.toFixed(1)}h`
      : null

  const actLabel =
    actuals.length === 1 && actStart
      ? actEnd
        ? `${actStart} – ${actEnd}`
        : `${actStart} →`
      : actHours > 0
      ? `${actuals.length} Bl. · ${actHours % 1 === 0 ? actHours : actHours.toFixed(1)}h`
      : actStart
      ? `${actStart} →`
      : null

  return (
    <button
      onClick={status !== 'empty' ? onClick : undefined}
      disabled={status === 'empty'}
      className={`
        w-full h-full min-h-[72px] rounded-md px-2 py-1.5 text-left transition-colors
        ${statusStyles[status]}
        ${status === 'empty' ? 'cursor-default' : 'cursor-pointer'}
      `}
      aria-label={status === 'empty' ? 'Kein Eintrag' : 'Zellendetails öffnen'}
    >
      {status === 'empty' && <span className="text-slate-300 text-xs">—</span>}

      {(status === 'plan-future' || status === 'plan-past') && planLabel && (
        <div>
          <div className={`text-xs font-medium ${status === 'plan-past' ? 'text-red-700' : 'text-slate-600'}`}>
            {planLabel}
          </div>
          {planHours > 0 && (
            <div className={`text-xs ${status === 'plan-past' ? 'text-red-500' : 'text-slate-400'}`}>
              {status === 'plan-past' && <span className="mr-1">✗</span>}
              {plans.length === 1 ? `${planHours % 1 === 0 ? planHours : planHours.toFixed(1)}h` : ''}
            </div>
          )}
        </div>
      )}

      {status === 'actual-only' && actLabel && (
        <div>
          <div className="text-xs font-medium text-orange-700">{actLabel}</div>
          {actHours > 0 && (
            <div className="text-xs text-orange-500">
              {actuals.length === 1 ? `${actHours % 1 === 0 ? actHours : actHours.toFixed(1)}h` : ''}
            </div>
          )}
          <div className="text-xs text-orange-400 mt-0.5">ungeplant</div>
        </div>
      )}

      {status === 'both' && (
        <div>
          <div className="text-xs font-medium text-green-700">
            {actLabel ?? planLabel}
            {hasOpenBlock && ' →'}
          </div>
          {(actHours > 0 || planHours > 0) && (
            <div className="text-xs text-green-600">
              {actHours > 0
                ? `${actHours % 1 === 0 ? actHours : actHours.toFixed(1)}h ✓`
                : `${planHours % 1 === 0 ? planHours : planHours.toFixed(1)}h`}
            </div>
          )}
        </div>
      )}

      {holidayName && (
        <div className="mt-1 text-xs italic text-slate-400 truncate">{holidayName}</div>
      )}
    </button>
  )
}
