'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase-browser'
import type { DayEntry } from '@/app/dashboard/wochenplanung/actions'
import {
  saveWeekPlan,
  loadPreviousWeekTemplate,
} from '@/app/dashboard/wochenplanung/actions'
import {
  getWeekDates,
  getPreviousWeek,
  getNextWeek,
  formatDate,
  dateToString,
  getWeekDateRange,
  getCalendarWeekNumber,
} from '@/lib/week-utils'

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']

interface DayState {
  keinArbeitstag: boolean
  start: string
  end: string
}

interface Props {
  weekStr: string
  initialEntries: DayEntry[]
  weeklyHourLimit: number
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0
  const diff = parseTimeToMinutes(end) - parseTimeToMinutes(start)
  return diff > 0 ? diff / 60 : 0
}

function formatHours(h: number): string {
  return h.toFixed(1).replace('.', ',') + ' Std'
}

function buildInitialState(entries: DayEntry[], weekDates: Date[]): Record<string, DayState> {
  const entryMap = new Map(entries.map((e) => [e.date, e]))
  return Object.fromEntries(
    weekDates.map((date) => {
      const dateStr = dateToString(date)
      const entry = entryMap.get(dateStr)
      return [
        dateStr,
        {
          keinArbeitstag: false,
          start: entry?.planned_start ?? '',
          end: entry?.planned_end ?? '',
        },
      ]
    })
  )
}

export default function WochenplanungClient({
  weekStr,
  initialEntries,
  weeklyHourLimit,
}: Props) {
  const router = useRouter()
  const weekDates = getWeekDates(weekStr)

  const [dayStates, setDayStates] = useState<Record<string, DayState>>(() =>
    buildInitialState(initialEntries, weekDates)
  )
  const [templateLoaded, setTemplateLoaded] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const totalHours = weekDates.reduce((sum, date) => {
    const dateStr = dateToString(date)
    const day = dayStates[dateStr]
    if (!day || day.keinArbeitstag) return sum
    return sum + calcHours(day.start, day.end)
  }, 0)

  const isOverLimit = totalHours > weeklyHourLimit

  const validationErrors: Record<string, string> = {}
  weekDates.forEach((date) => {
    const dateStr = dateToString(date)
    const day = dayStates[dateStr]
    if (day && !day.keinArbeitstag && day.start && day.end) {
      if (parseTimeToMinutes(day.start) >= parseTimeToMinutes(day.end)) {
        validationErrors[dateStr] = 'Startzeit muss vor der Endzeit liegen'
      }
    }
  })
  const hasValidationErrors = Object.keys(validationErrors).length > 0

  function updateDay(dateStr: string, updates: Partial<DayState>) {
    setDayStates((prev) => ({ ...prev, [dateStr]: { ...prev[dateStr], ...updates } }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const entries: DayEntry[] = weekDates.map((date) => {
      const dateStr = dateToString(date)
      const day = dayStates[dateStr]
      const hasValidTimes = day && !day.keinArbeitstag && day.start && day.end
      return {
        date: dateStr,
        planned_start: hasValidTimes ? day.start : null,
        planned_end: hasValidTimes ? day.end : null,
      }
    })

    const result = await saveWeekPlan(weekStr, entries)
    setSaving(false)

    if (result.error) {
      setSaveError(result.error)
    } else {
      toast.success('Plan gespeichert')
    }
  }

  async function handleLoadTemplate() {
    setLoadingTemplate(true)
    const result = await loadPreviousWeekTemplate(weekStr)
    setLoadingTemplate(false)

    if (result.error) {
      toast.error('Vorlage konnte nicht geladen werden')
      return
    }

    if (!result.data || result.data.length === 0) {
      toast.info('Keine Einträge in der Vorwoche gefunden')
      return
    }

    const prevWeekDates = getWeekDates(getPreviousWeek(weekStr))
    const templateByDayIndex = new Map(
      result.data.map((entry) => {
        const dayIndex = prevWeekDates.findIndex((d) => dateToString(d) === entry.date)
        return [dayIndex, entry]
      })
    )

    setDayStates((prev) => {
      const next = { ...prev }
      weekDates.forEach((date, i) => {
        const dateStr = dateToString(date)
        const template = templateByDayIndex.get(i)
        if (template) {
          next[dateStr] = {
            keinArbeitstag: false,
            start: template.planned_start ?? '',
            end: template.planned_end ?? '',
          }
        }
      })
      return next
    })

    setTemplateLoaded(true)
    toast.success('Vorlage der Vorwoche übernommen')
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function navigateWeek(newWeekStr: string) {
    router.push(`/dashboard/wochenplanung?week=${newWeekStr}`)
  }

  const kwNumber = getCalendarWeekNumber(weekStr)
  const dateRange = getWeekDateRange(weekStr)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-slate-700"
        >
          Abmelden
        </Button>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-3xl mx-auto flex gap-1">
          <a
            href="/dashboard"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Dashboard
          </a>
          <a
            href="/dashboard/wochenplanung"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600"
          >
            Wochenplanung
          </a>
          <a
            href="/dashboard/profile"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Mein Profil
          </a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Wochenplanung</h1>
          <p className="text-slate-500 mt-1 text-sm">Plane deine Arbeitszeiten für die Woche</p>
        </div>

        {/* Week navigator */}
        <div className="flex items-center justify-between mb-5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek(getPreviousWeek(weekStr))}
          >
            ← Zurück
          </Button>
          <div className="text-center">
            <span className="font-semibold text-slate-900">KW {kwNumber}</span>
            <span className="text-slate-500 text-sm ml-2">{dateRange}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek(getNextWeek(weekStr))}
          >
            Weiter →
          </Button>
        </div>

        {/* Template banner */}
        {!templateLoaded && (
          <Alert className="mb-5 bg-blue-50 border-blue-200">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                Vorwoche als Vorlage übernehmen?
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadTemplate}
                disabled={loadingTemplate}
                className="ml-4 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                {loadingTemplate ? 'Lade…' : 'Übernehmen'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Week plan table */}
        <Card className="mb-5 border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {weekDates.map((date, i) => {
                const dateStr = dateToString(date)
                const day = dayStates[dateStr] ?? {
                  keinArbeitstag: false,
                  start: '',
                  end: '',
                }
                const dayHours = !day.keinArbeitstag ? calcHours(day.start, day.end) : 0
                const hasError = !!validationErrors[dateStr]

                return (
                  <div
                    key={dateStr}
                    className={`p-4 ${day.keinArbeitstag ? 'bg-slate-50/60' : ''}`}
                  >
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                      {/* Day label */}
                      <div className="w-28 flex-shrink-0 pt-1">
                        <div className="font-medium text-slate-900 text-sm">{DAY_NAMES[i]}</div>
                        <div className="text-xs text-slate-500">{formatDate(date)}</div>
                      </div>

                      {/* kein Arbeitstag checkbox */}
                      <div className="flex items-center gap-1.5 pt-1.5 flex-shrink-0">
                        <Checkbox
                          id={`nowork-${dateStr}`}
                          checked={day.keinArbeitstag}
                          onCheckedChange={(checked) =>
                            updateDay(dateStr, { keinArbeitstag: !!checked })
                          }
                        />
                        <label
                          htmlFor={`nowork-${dateStr}`}
                          className="text-xs text-slate-500 cursor-pointer select-none whitespace-nowrap"
                        >
                          kein Arbeitstag
                        </label>
                      </div>

                      {/* Time inputs or placeholder */}
                      {day.keinArbeitstag ? (
                        <div className="flex-1 flex items-center pt-1">
                          <span className="text-sm text-slate-400 italic">—</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Von</span>
                            <Input
                              type="time"
                              value={day.start}
                              onChange={(e) => updateDay(dateStr, { start: e.target.value })}
                              className={`w-28 text-sm ${hasError ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Bis</span>
                            <Input
                              type="time"
                              value={day.end}
                              onChange={(e) => updateDay(dateStr, { end: e.target.value })}
                              className={`w-28 text-sm ${hasError ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                            />
                          </div>
                          <div className="ml-auto text-sm font-medium text-slate-700 tabular-nums">
                            {dayHours > 0 ? formatHours(dayHours) : '–'}
                          </div>
                        </div>
                      )}
                    </div>

                    {hasError && (
                      <p className="text-xs text-red-500 mt-1.5 ml-32">
                        {validationErrors[dateStr]}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Hours summary */}
        <Card
          className={`mb-6 shadow-sm ${isOverLimit ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}
        >
          <CardContent className="py-4 px-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-600">Geplant diese Woche:</span>
                <span
                  className={`ml-2 font-bold text-lg tabular-nums ${isOverLimit ? 'text-orange-600' : 'text-slate-900'}`}
                >
                  {totalHours.toFixed(1).replace('.', ',')} / {weeklyHourLimit},0 Std
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
                Dein Wochenstundenlimit von {weeklyHourLimit}h wird überschritten. Bitte passe
                deinen Plan an.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Save error */}
        {saveError && (
          <Alert className="mb-4 border-red-300 bg-red-50">
            <AlertDescription className="text-red-700 text-sm">{saveError}</AlertDescription>
          </Alert>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || hasValidationErrors}
            className="px-8"
          >
            {saving ? 'Speichern…' : 'Plan speichern'}
          </Button>
        </div>
      </main>
    </div>
  )
}
