import type { PlannedEntry, ActualEntry } from '@/lib/database.types'

interface Props {
  plan: PlannedEntry | null
  actual: ActualEntry | null
  date: string
  today: string
  onClick: () => void
}

type CellStatus = 'empty' | 'plan-future' | 'plan-past' | 'actual-only' | 'both'

function getCellStatus(
  plan: PlannedEntry | null,
  actual: ActualEntry | null,
  date: string,
  today: string
): CellStatus {
  const isPast = date < today
  if (!plan && !actual) return 'empty'
  if (!plan && actual) return 'actual-only'
  if (plan && actual) return 'both'
  return isPast ? 'plan-past' : 'plan-future'
}

function normalizeTime(t: string | null): string | null {
  return t ? t.substring(0, 5) : null
}

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

const statusStyles: Record<CellStatus, string> = {
  empty: 'bg-transparent hover:bg-slate-50',
  'plan-future': 'bg-slate-100 hover:bg-slate-200',
  'plan-past': 'bg-red-50 hover:bg-red-100 border border-red-200',
  'actual-only': 'bg-orange-50 hover:bg-orange-100 border border-orange-200',
  both: 'bg-green-50 hover:bg-green-100 border border-green-200',
}

export default function KalenderZelle({ plan, actual, date, today, onClick }: Props) {
  const status = getCellStatus(plan, actual, date, today)

  const planStart = normalizeTime(plan?.planned_start ?? null)
  const planEnd = normalizeTime(plan?.planned_end ?? null)
  const actStart = normalizeTime(actual?.actual_start ?? null)
  const actEnd = normalizeTime(actual?.actual_end ?? null)

  const planHours = planStart && planEnd ? calcHours(planStart, planEnd) : null
  const actHours = actStart && actEnd ? calcHours(actStart, actEnd) : null

  return (
    <button
      onClick={status !== 'empty' ? onClick : undefined}
      disabled={status === 'empty'}
      className={`
        w-full h-full min-h-[72px] rounded-md px-2 py-1.5 text-left transition-colors
        ${statusStyles[status]}
        ${status === 'empty' ? 'cursor-default' : 'cursor-pointer'}
      `}
      aria-label={
        status === 'empty' ? 'Kein Eintrag' : 'Zellendetails öffnen'
      }
    >
      {status === 'empty' && (
        <span className="text-slate-300 text-xs">—</span>
      )}

      {(status === 'plan-future' || status === 'plan-past') && planStart && planEnd && (
        <div>
          <div className={`text-xs font-medium ${status === 'plan-past' ? 'text-red-700' : 'text-slate-600'}`}>
            {planStart} – {planEnd}
          </div>
          {planHours !== null && (
            <div className={`text-xs ${status === 'plan-past' ? 'text-red-500' : 'text-slate-400'}`}>
              {planHours % 1 === 0 ? planHours : planHours.toFixed(1)}h
              {status === 'plan-past' && <span className="ml-1">✗</span>}
            </div>
          )}
        </div>
      )}

      {status === 'actual-only' && actStart && (
        <div>
          <div className="text-xs font-medium text-orange-700">
            {actStart}{actEnd ? ` – ${actEnd}` : ' →'}
          </div>
          {actHours !== null && (
            <div className="text-xs text-orange-500">
              {actHours % 1 === 0 ? actHours : actHours.toFixed(1)}h
            </div>
          )}
          <div className="text-xs text-orange-400 mt-0.5">ungeplant</div>
        </div>
      )}

      {status === 'both' && (
        <div>
          <div className="text-xs font-medium text-green-700">
            {actStart ?? planStart}{actEnd ? ` – ${actEnd}` : actStart ? ' →' : ` – ${planEnd}`}
          </div>
          {(actHours ?? planHours) !== null && (
            <div className="text-xs text-green-600">
              {((actHours ?? planHours)! % 1 === 0
                ? (actHours ?? planHours)
                : (actHours ?? planHours)!.toFixed(1)
              )}h ✓
            </div>
          )}
        </div>
      )}
    </button>
  )
}
