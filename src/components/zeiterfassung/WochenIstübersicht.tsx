'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { calcBlockHours } from '@/lib/time-block-utils'

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

interface Props {
  weekStr: string
  today: string
  weeklyHourLimit: number
  actualEntries: ActualEntry[]
  plannedEntries: PlannedEntry[]
  onWeekChange: (newWeek: string) => void
  onEntryChange: (entry: ActualEntry) => void
  onEntryDeleted: (entryId: string) => void
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
  onEntryDeleted,
}: Props) {
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null)
  const [blockEditEntry, setBlockEditEntry] = useState<ActualEntry | null>(null)

  const weekDates = getWeekDates(weekStr)
  const kwNumber = getCalendarWeekNumber(weekStr)
  const dateRange = getWeekDateRange(weekStr)

  // Group by date
  const actualByDate = new Map<string, ActualEntry[]>()
  for (const e of actualEntries) {
    if (!actualByDate.has(e.date)) actualByDate.set(e.date, [])
    actualByDate.get(e.date)!.push(e)
  }

  const plannedByDate = new Map<string, PlannedEntry[]>()
  for (const e of plannedEntries) {
    if (!plannedByDate.has(e.date)) plannedByDate.set(e.date, [])
    plannedByDate.get(e.date)!.push(e)
  }

  const totalIstHours = actualEntries.reduce(
    (sum, e) => sum + calcBlockHours(e.actual_start, e.actual_end),
    0
  )
  const isOverLimit = totalIstHours > weeklyHourLimit

  // Day detail dialog state
  const dayDetailEntries = dayDetailDate ? (actualByDate.get(dayDetailDate) ?? []) : []

  function handleEditSaved(entry: ActualEntry) {
    onEntryChange(entry)
    setBlockEditEntry(null)
  }

  function handleEditDeleted(entryId: string) {
    onEntryDeleted(entryId)
    setBlockEditEntry(null)
    // Close day detail if no more entries
    if (dayDetailDate) {
      const remaining = (actualByDate.get(dayDetailDate) ?? []).filter((e) => e.id !== entryId)
      if (remaining.length === 0) setDayDetailDate(null)
    }
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

      {/* Table */}
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
              const actuals = actualByDate.get(dateStr) ?? []
              const planneds = plannedByDate.get(dateStr) ?? []
              const isToday = dateStr === today
              const isFuture = dateStr > today
              const hasOpenBlock = actuals.some((e) => !e.is_complete)

              const planH = planneds.reduce(
                (s, e) => s + calcBlockHours(e.planned_start, e.planned_end),
                0
              )
              const istH = actuals.reduce(
                (s, e) => s + calcBlockHours(e.actual_start, e.actual_end),
                0
              )
              const diff = calcDiff(planH, istH)

              // IST display
              let istDisplay: React.ReactNode
              if (actuals.length === 0) {
                istDisplay = <span className="text-slate-300">—</span>
              } else if (actuals.length === 1) {
                const a = actuals[0]
                const isIncomplete = !a.is_complete
                istDisplay = (
                  <span className={`flex items-center gap-1.5 ${isIncomplete ? 'text-amber-600' : 'text-slate-900'}`}>
                    {formatTime(a.actual_start)}
                    {a.actual_end ? `–${formatTime(a.actual_end)}` : '…'}
                    {isIncomplete && (
                      <Badge className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
                        offen
                      </Badge>
                    )}
                  </span>
                )
              } else {
                istDisplay = (
                  <span className={`flex items-center gap-1.5 ${hasOpenBlock ? 'text-amber-600' : 'text-slate-900'}`}>
                    {actuals.length} Bl.
                    {istH > 0 && (
                      <span className="text-slate-500">· {formatHours(istH)}</span>
                    )}
                    {hasOpenBlock && (
                      <Badge className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
                        offen
                      </Badge>
                    )}
                  </span>
                )
              }

              // Plan display
              let planDisplay: React.ReactNode
              if (planneds.length === 0) {
                planDisplay = <span className="text-slate-300">—</span>
              } else if (planneds.length === 1) {
                planDisplay = `${formatTime(planneds[0].planned_start)}–${formatTime(planneds[0].planned_end)}`
              } else {
                planDisplay = `${planneds.length} Bl. · ${formatHours(planH)}`
              }

              return (
                <div
                  key={dateStr}
                  className={`grid grid-cols-[88px_1fr_1fr_64px_80px] gap-2 px-4 py-3 items-center border-b border-slate-50 last:border-0 ${
                    isToday ? 'bg-blue-50/50' : ''
                  }`}
                >
                  {/* Day */}
                  <div>
                    <div className={`text-sm ${isToday ? 'font-bold text-blue-700' : 'font-medium text-slate-900'}`}>
                      {DAY_NAMES[i]}
                    </div>
                    <div className="text-xs text-slate-400">{formatDate(date)}</div>
                  </div>

                  {/* Plan */}
                  <div className="text-sm text-slate-600">{planDisplay}</div>

                  {/* Ist */}
                  <div className="text-sm">{istDisplay}</div>

                  {/* Diff */}
                  <div className={`text-sm font-medium tabular-nums ${diff ? (diff.positive ? 'text-green-600' : 'text-red-500') : 'text-slate-300'}`}>
                    {diff ? diff.text : '—'}
                  </div>

                  {/* Edit */}
                  <div className="flex justify-end">
                    {!isFuture && actuals.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-400 hover:text-slate-700 px-2"
                        onClick={() => setDayDetailDate(dateStr)}
                      >
                        Blöcke
                      </Button>
                    )}
                    {!isFuture && actuals.length === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-400 hover:text-slate-700 px-2"
                        onClick={() => {
                          setBlockEditEntry(null)
                          setDayDetailDate(dateStr)
                        }}
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
      <Card className={`shadow-sm ${isOverLimit ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}>
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="text-sm text-slate-600">Ist-Stunden diese Woche:</span>
              <span className={`ml-2 font-bold text-lg tabular-nums ${isOverLimit ? 'text-orange-600' : 'text-slate-900'}`}>
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
              Du hast diese Woche bereits {formatHours(totalIstHours)}/{weeklyHourLimit}h gearbeitet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Day detail dialog — shows all blocks for a day */}
      <Dialog open={!!dayDetailDate} onOpenChange={(open) => !open && setDayDetailDate(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Blöcke – {dayDetailDate ? dayDetailDate.split('-').reverse().join('.') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {dayDetailEntries.length === 0 && (
              <p className="text-sm text-slate-400">Keine Einträge für diesen Tag.</p>
            )}
            {dayDetailEntries.map((entry) => {
              const h = calcBlockHours(entry.actual_start, entry.actual_end)
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200"
                >
                  <div>
                    <span className="text-sm text-slate-800">
                      {formatTime(entry.actual_start)}
                      {entry.actual_end ? ` – ${formatTime(entry.actual_end)} Uhr` : ' – laufend'}
                    </span>
                    {h > 0 && (
                      <span className="text-xs text-slate-400 ml-2">{formatHours(h)}</span>
                    )}
                    {!entry.is_complete && (
                      <Badge className="ml-2 text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
                        offen
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-400 hover:text-slate-700 px-2"
                    onClick={() => setBlockEditEntry(entry)}
                  >
                    Bearbeiten
                  </Button>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Block edit dialog */}
      {blockEditEntry && (
        <IstEintragEditDialog
          open
          date={blockEditEntry.date}
          entry={blockEditEntry}
          otherEntries={(actualByDate.get(blockEditEntry.date) ?? []).filter(
            (e) => e.id !== blockEditEntry.id
          )}
          onClose={() => setBlockEditEntry(null)}
          onSaved={handleEditSaved}
          onDeleted={handleEditDeleted}
        />
      )}
    </div>
  )
}
