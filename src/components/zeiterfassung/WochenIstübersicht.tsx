'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import IstEintragEditDialog from './IstEintragEditDialog'
import {
  getWeekDates,
  getPreviousWeek,
  getNextWeek,
  formatDate,
  dateToString,
  getWeekDateRange,
  getCalendarWeekNumber,
} from '@/lib/week-utils'
import type { ActualEntry, PlannedEntry } from '@/lib/database.types'

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

interface Props {
  weekStr: string
  today: string
  weeklyHourLimit: number
  actualEntries: ActualEntry[]
  plannedEntries: PlannedEntry[]
  onWeekChange: (newWeek: string) => void
  onEntryChange: (entry: ActualEntry) => void
}

function calcHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = eh * 60 + em - (sh * 60 + sm)
  return diff > 0 ? diff / 60 : 0
}

function formatTime(time: string | null): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

function formatHours(h: number): string {
  return h.toFixed(1).replace('.', ',') + 'h'
}

type DiffResult = { text: string; positive: boolean }

function calcDiff(planH: number, istH: number): DiffResult | null {
  if (planH === 0 && istH === 0) return null
  const diff = istH - planH
  if (diff === 0) return { text: '±0h', positive: true }
  const sign = diff > 0 ? '+' : ''
  return { text: sign + diff.toFixed(1).replace('.', ',') + 'h', positive: diff >= 0 }
}

export default function WochenIstübersicht({
  weekStr,
  today,
  weeklyHourLimit,
  actualEntries,
  plannedEntries,
  onWeekChange,
  onEntryChange,
}: Props) {
  const [editState, setEditState] = useState<{ date: string; entry: ActualEntry | null } | null>(
    null
  )

  const weekDates = getWeekDates(weekStr)
  const kwNumber = getCalendarWeekNumber(weekStr)
  const dateRange = getWeekDateRange(weekStr)

  const actualByDate = new Map(actualEntries.map((e) => [e.date, e]))
  const plannedByDate = new Map(plannedEntries.map((e) => [e.date, e]))

  const totalIstHours = actualEntries.reduce(
    (sum, e) => sum + calcHours(e.actual_start, e.actual_end),
    0
  )
  const isOverLimit = totalIstHours > weeklyHourLimit

  function handleEditSaved(entry: ActualEntry) {
    onEntryChange(entry)
    setEditState(null)
  }

  return (
    <div>
      {/* Week navigator */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onWeekChange(getPreviousWeek(weekStr))}
        >
          ← Zurück
        </Button>
        <div className="text-center">
          <span className="font-semibold text-slate-900">KW {kwNumber}</span>
          <span className="text-slate-500 text-sm ml-2">{dateRange}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => onWeekChange(getNextWeek(weekStr))}>
          Weiter →
        </Button>
      </div>

      {/* Scrollable table */}
      <Card className="border-slate-200 shadow-sm mb-4 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[520px]">
            {/* Header */}
            <div className="grid grid-cols-[88px_1fr_1fr_64px_80px] gap-2 px-4 py-2 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
              <div>Tag</div>
              <div>Plan</div>
              <div>Ist</div>
              <div>Diff.</div>
              <div></div>
            </div>

            {weekDates.map((date, i) => {
              const dateStr = dateToString(date)
              const actual = actualByDate.get(dateStr) ?? null
              const planned = plannedByDate.get(dateStr) ?? null
              const isToday = dateStr === today
              const isFuture = dateStr > today
              const isIncomplete = actual && !actual.is_complete

              const planH = calcHours(
                planned?.planned_start ?? null,
                planned?.planned_end ?? null
              )
              const istH = calcHours(actual?.actual_start ?? null, actual?.actual_end ?? null)
              const diff = calcDiff(planH, istH)

              return (
                <div
                  key={dateStr}
                  className={`grid grid-cols-[88px_1fr_1fr_64px_80px] gap-2 px-4 py-3 items-center border-b border-slate-50 last:border-0 ${
                    isToday ? 'bg-blue-50/50' : ''
                  }`}
                >
                  {/* Day */}
                  <div>
                    <div
                      className={`text-sm ${
                        isToday ? 'font-bold text-blue-700' : 'font-medium text-slate-900'
                      }`}
                    >
                      {DAY_NAMES[i]}
                    </div>
                    <div className="text-xs text-slate-400">{formatDate(date)}</div>
                  </div>

                  {/* Plan */}
                  <div className="text-sm text-slate-600">
                    {planned?.planned_start && planned?.planned_end ? (
                      `${formatTime(planned.planned_start)}–${formatTime(planned.planned_end)}`
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>

                  {/* Ist */}
                  <div className="text-sm">
                    {actual ? (
                      <span
                        className={`flex items-center gap-1.5 flex-wrap ${
                          isIncomplete ? 'text-amber-600' : 'text-slate-900'
                        }`}
                      >
                        {formatTime(actual.actual_start)}
                        {actual.actual_end ? `–${formatTime(actual.actual_end)}` : '…'}
                        {isIncomplete && (
                          <Badge className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
                            offen
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>

                  {/* Diff */}
                  <div
                    className={`text-sm font-medium tabular-nums ${
                      diff
                        ? diff.positive
                          ? 'text-green-600'
                          : 'text-red-500'
                        : 'text-slate-300'
                    }`}
                  >
                    {diff ? diff.text : '—'}
                  </div>

                  {/* Edit */}
                  <div className="flex justify-end">
                    {!isFuture && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-400 hover:text-slate-700 px-2"
                        onClick={() => setEditState({ date: dateStr, entry: actual })}
                      >
                        Bearbeiten
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Weekly sum */}
      <Card
        className={`shadow-sm ${isOverLimit ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}
      >
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="text-sm text-slate-600">Ist-Stunden diese Woche:</span>
              <span
                className={`ml-2 font-bold text-lg tabular-nums ${
                  isOverLimit ? 'text-orange-600' : 'text-slate-900'
                }`}
              >
                {formatHours(totalIstHours)} / {weeklyHourLimit},0 Std
              </span>
            </div>
            {isOverLimit && (
              <Badge className="bg-orange-100 text-orange-700 border border-orange-300 hover:bg-orange-100">
                Limit überschritten
              </Badge>
            )}
          </div>
          {isOverLimit && (
            <p className="text-xs text-orange-600 mt-2">
              Du hast diese Woche bereits {formatHours(totalIstHours)}/{weeklyHourLimit}h
              gearbeitet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      {editState && (
        <IstEintragEditDialog
          open
          date={editState.date}
          entry={editState.entry}
          onClose={() => setEditState(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  )
}
