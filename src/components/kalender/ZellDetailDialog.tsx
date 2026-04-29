'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { PlannedEntry, ActualEntry } from '@/lib/database.types'
import { calcBlockHours } from '@/lib/time-block-utils'

export interface SelectedCell {
  userName: string
  date: string
  plans: PlannedEntry[]
  actuals: ActualEntry[]
}

interface Props {
  cell: SelectedCell | null
  onClose: () => void
}

function normalizeTime(t: string | null): string | null {
  return t ? t.substring(0, 5) : null
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

  const planH = cell.plans.reduce((s, p) => s + calcBlockHours(p.planned_start, p.planned_end), 0)
  const actH = cell.actuals.reduce((s, a) => s + calcBlockHours(a.actual_start, a.actual_end), 0)

  let diffLabel: string | null = null
  let diffPositive = true
  if (planH > 0 || actH > 0) {
    const diff = actH - planH
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
              {planH > 0 && (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                  {formatHours(planH)}
                </Badge>
              )}
            </div>
            {cell.plans.length === 0 ? (
              <p className="text-sm text-slate-400">Kein Plan eingetragen</p>
            ) : (
              <div className="space-y-1">
                {cell.plans.map((p, i) => {
                  const s = normalizeTime(p.planned_start)
                  const e = normalizeTime(p.planned_end)
                  return (
                    <p key={p.id} className="text-sm font-medium text-slate-900">
                      {cell.plans.length > 1 && (
                        <span className="text-xs text-slate-400 mr-1">Block {i + 1}:</span>
                      )}
                      {s} – {e} Uhr
                    </p>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actual section */}
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Tatsächlich
              </span>
              {actH > 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                  {formatHours(actH)}
                </Badge>
              )}
            </div>
            {cell.actuals.length === 0 ? (
              <p className="text-sm text-slate-400">Nicht gestempelt</p>
            ) : (
              <div className="space-y-1">
                {cell.actuals.map((a, i) => {
                  const s = normalizeTime(a.actual_start)
                  const e = normalizeTime(a.actual_end)
                  return (
                    <p key={a.id} className={`text-sm font-medium ${!a.is_complete ? 'text-orange-600' : 'text-slate-900'}`}>
                      {cell.actuals.length > 1 && (
                        <span className="text-xs text-slate-400 mr-1">Block {i + 1}:</span>
                      )}
                      {s} Uhr
                      {e ? ` – ${e} Uhr` : (
                        <span className="text-orange-500"> – noch nicht ausgestempelt</span>
                      )}
                    </p>
                  )
                })}
              </div>
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
