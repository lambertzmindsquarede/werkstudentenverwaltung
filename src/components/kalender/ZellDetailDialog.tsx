'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { PlannedEntry, ActualEntry } from '@/lib/database.types'

export interface SelectedCell {
  userName: string
  date: string
  plan: PlannedEntry | null
  actual: ActualEntry | null
}

interface Props {
  cell: SelectedCell | null
  onClose: () => void
}

function normalizeTime(t: string | null): string | null {
  return t ? t.substring(0, 5) : null
}

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

function formatHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function ZellDetailDialog({ cell, onClose }: Props) {
  if (!cell) return null

  const planStart = normalizeTime(cell.plan?.planned_start ?? null)
  const planEnd = normalizeTime(cell.plan?.planned_end ?? null)
  const actStart = normalizeTime(cell.actual?.actual_start ?? null)
  const actEnd = normalizeTime(cell.actual?.actual_end ?? null)

  const planHours = planStart && planEnd ? calcHours(planStart, planEnd) : null
  const actHours = actStart && actEnd ? calcHours(actStart, actEnd) : null

  let diffLabel: string | null = null
  let diffPositive = true
  if (planHours !== null && actHours !== null) {
    const diff = actHours - planHours
    diffPositive = diff >= 0
    diffLabel =
      diff === 0
        ? 'Genau wie geplant'
        : `${diff > 0 ? '+' : ''}${formatHours(diff)} ${diff > 0 ? 'mehr' : 'weniger'} als geplant`
  }

  return (
    <Dialog open={!!cell} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{cell.userName}</DialogTitle>
          <p className="text-sm text-slate-500 capitalize">{formatDate(cell.date)}</p>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Plan section */}
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Geplant
              </span>
              {cell.plan ? (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                  {planHours !== null ? formatHours(planHours) : '—'}
                </Badge>
              ) : null}
            </div>
            {cell.plan && planStart && planEnd ? (
              <p className="text-sm font-medium text-slate-900">
                {planStart} – {planEnd} Uhr
              </p>
            ) : (
              <p className="text-sm text-slate-400">Kein Plan eingetragen</p>
            )}
          </div>

          {/* Actual section */}
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Tatsächlich
              </span>
              {actHours !== null ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                  {formatHours(actHours)}
                </Badge>
              ) : null}
            </div>
            {cell.actual ? (
              actStart ? (
                actEnd ? (
                  <p className="text-sm font-medium text-slate-900">
                    {actStart} – {actEnd} Uhr
                  </p>
                ) : (
                  <p className="text-sm text-slate-700">
                    {actStart} Uhr – <span className="text-orange-500">noch nicht ausgestempelt</span>
                  </p>
                )
              ) : (
                <p className="text-sm text-slate-400">Eingestempelt (keine Startzeit)</p>
              )
            ) : (
              <p className="text-sm text-slate-400">Nicht gestempelt</p>
            )}
          </div>

          {/* Difference */}
          {diffLabel && (
            <div className={`text-xs text-center font-medium ${diffPositive ? 'text-green-600' : 'text-orange-600'}`}>
              {diffLabel}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
