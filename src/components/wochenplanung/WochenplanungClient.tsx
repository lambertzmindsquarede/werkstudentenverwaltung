'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { validateBlocks, type BlockValidationError } from '@/lib/time-block-utils'
import { usePublicHolidays } from '@/hooks/usePublicHolidays'

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']

function generateTimeOptions(): string[] {
  const options: string[] = []
  for (let h = 6; h <= 22; h++) {
    const maxMinute = h === 22 ? 0 : 45
    for (let m = 0; m <= maxMinute; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

function roundToQuarterHour(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const roundedM = Math.round(m / 15) * 15
  const finalH = roundedM === 60 ? h + 1 : h
  const finalM = roundedM === 60 ? 0 : roundedM
  const result = `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`
  if (result < '06:00') return '06:00'
  if (result > '22:00') return '22:00'
  return result
}

interface TimeBlock {
  start: string
  end: string
}

interface DayState {
  keinArbeitstag: boolean
  blocks: TimeBlock[]
}

interface Props {
  weekStr: string
  initialEntries: DayEntry[]
  weeklyHourLimit: number
  bundesland: string
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = eh * 60 + em - (sh * 60 + sm)
  return diff > 0 ? diff / 60 : 0
}

function formatHours(h: number): string {
  return h.toFixed(1).replace('.', ',') + ' Std'
}

function buildInitialState(entries: DayEntry[], weekDates: Date[]): Record<string, DayState> {
  const entriesByDate = new Map<string, DayEntry[]>()
  for (const e of entries) {
    if (!entriesByDate.has(e.date)) entriesByDate.set(e.date, [])
    entriesByDate.get(e.date)!.push(e)
  }

  return Object.fromEntries(
    weekDates.map((date) => {
      const dateStr = dateToString(date)
      const dayEntries = (entriesByDate.get(dateStr) ?? []).sort(
        (a, b) => a.block_index - b.block_index
      )
      const blocks: TimeBlock[] =
        dayEntries.length > 0
          ? dayEntries.map((e) => ({
              start: e.planned_start ? roundToQuarterHour(e.planned_start) : '',
              end: e.planned_end ? roundToQuarterHour(e.planned_end) : '',
            }))
          : [{ start: '', end: '' }]
      return [dateStr, { keinArbeitstag: false, blocks }]
    })
  )
}

function canAddBlock(day: DayState): boolean {
  if (day.blocks.length === 0) return true
  const last = day.blocks[day.blocks.length - 1]
  return !!(last.start && last.end)
}

function calcDayHours(day: DayState): number {
  if (day.keinArbeitstag) return 0
  return day.blocks.reduce((sum, b) => sum + calcHours(b.start, b.end), 0)
}

export default function WochenplanungClient({
  weekStr,
  initialEntries,
  weeklyHourLimit,
  bundesland,
}: Props) {
  const router = useRouter()
  const weekDates = getWeekDates(weekStr)
  const today = useMemo(() => new Date().toLocaleDateString('sv'), [])
  const isPast = (dateStr: string) => dateStr < today
  const hasAnyPastDay = weekDates.some((d) => isPast(dateToString(d)))
  const allDaysPast = weekDates.every((d) => isPast(dateToString(d)))

  const weekYear = parseInt(weekStr.slice(0, 4), 10)
  const lastDateYear = parseInt(dateToString(weekDates[4]).slice(0, 4), 10)
  const needsBothYears = lastDateYear !== weekYear
  const { isHoliday: isHolidayA, getHolidayName: getHolidayNameA } = usePublicHolidays(bundesland, weekYear)
  const { isHoliday: isHolidayB, getHolidayName: getHolidayNameB } = usePublicHolidays(
    bundesland,
    needsBothYears ? lastDateYear : weekYear
  )

  function isHoliday(date: string): boolean {
    return isHolidayA(date) || isHolidayB(date)
  }
  function getHolidayName(date: string): string | null {
    return getHolidayNameA(date) ?? getHolidayNameB(date)
  }

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
    return sum + calcDayHours(day ?? { keinArbeitstag: true, blocks: [] })
  }, 0)

  const isOverLimit = totalHours > weeklyHourLimit

  const validationErrors: Record<string, BlockValidationError[]> = {}
  weekDates.forEach((date) => {
    const dateStr = dateToString(date)
    const day = dayStates[dateStr]
    if (!day || day.keinArbeitstag) return
    const completedBlocks = day.blocks
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: b.start, end: b.end }))
    const errors = validateBlocks(completedBlocks)
    if (errors.length > 0) validationErrors[dateStr] = errors
  })
  const hasValidationErrors = Object.keys(validationErrors).length > 0

  function updateBlock(dateStr: string, blockIdx: number, field: 'start' | 'end', value: string) {
    setDayStates((prev) => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        blocks: prev[dateStr].blocks.map((b, i) =>
          i === blockIdx ? { ...b, [field]: value } : b
        ),
      },
    }))
  }

  function addBlock(dateStr: string) {
    setDayStates((prev) => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        blocks: [...prev[dateStr].blocks, { start: '', end: '' }],
      },
    }))
  }

  function removeBlock(dateStr: string, blockIdx: number) {
    setDayStates((prev) => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        blocks: prev[dateStr].blocks.filter((_, i) => i !== blockIdx),
      },
    }))
  }

  function updateDayFlag(dateStr: string, keinArbeitstag: boolean) {
    setDayStates((prev) => ({ ...prev, [dateStr]: { ...prev[dateStr], keinArbeitstag } }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const entries: DayEntry[] = []
    let blockedByHoliday = false
    weekDates.forEach((date) => {
      const dateStr = dateToString(date)
      if (isPast(dateStr)) return
      const day = dayStates[dateStr]
      if (!day || day.keinArbeitstag) return
      const hasNewBlocks = day.blocks.some((b) => b.start && b.end)
      if (hasNewBlocks && isHoliday(dateStr)) {
        blockedByHoliday = true
        return
      }
      day.blocks.forEach((block, i) => {
        if (block.start && block.end) {
          entries.push({
            date: dateStr,
            planned_start: block.start,
            planned_end: block.end,
            block_index: i + 1,
          })
        }
      })
    })

    if (blockedByHoliday) {
      setSaveError('Planung nicht möglich: Mindestens ein ausgewählter Tag ist ein gesetzlicher Feiertag.')
      setSaving(false)
      return
    }

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
    const templateByDayIndex = new Map<number, DayEntry[]>()
    result.data.forEach((entry) => {
      const dayIndex = prevWeekDates.findIndex((d) => dateToString(d) === entry.date)
      if (dayIndex >= 0) {
        if (!templateByDayIndex.has(dayIndex)) templateByDayIndex.set(dayIndex, [])
        templateByDayIndex.get(dayIndex)!.push(entry)
      }
    })

    setDayStates((prev) => {
      const next = { ...prev }
      weekDates.forEach((date, i) => {
        const dateStr = dateToString(date)
        if (isPast(dateStr)) return
        const dayEntries = templateByDayIndex.get(i)
        if (dayEntries && dayEntries.length > 0) {
          const blocks = dayEntries
            .sort((a, b) => a.block_index - b.block_index)
            .map((e) => ({
              start: e.planned_start ? roundToQuarterHour(e.planned_start) : '',
              end: e.planned_end ? roundToQuarterHour(e.planned_end) : '',
            }))
          next[dateStr] = { keinArbeitstag: false, blocks }
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

        {/* Past-days info banner */}
        {hasAnyPastDay && (
          <Alert className="mb-5 bg-slate-50 border-slate-300">
            <AlertDescription className="text-sm text-slate-600">
              Vergangene Tage können nicht bearbeitet werden.
            </AlertDescription>
          </Alert>
        )}

        {/* Template banner */}
        {!templateLoaded && !allDaysPast && (
          <Alert className="mb-5 bg-blue-50 border-blue-200">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm text-blue-800">Vorwoche als Vorlage übernehmen?</span>
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

        {/* Week plan */}
        <Card className="mb-5 border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {weekDates.map((date, i) => {
                const dateStr = dateToString(date)
                const day = dayStates[dateStr] ?? { keinArbeitstag: false, blocks: [{ start: '', end: '' }] }
                const dayErrors = validationErrors[dateStr] ?? []
                const dayHours = calcDayHours(day)
                const holidayName = getHolidayName(dateStr)
                const isHolidayDay = !!holidayName
                const isPastDay = isPast(dateStr)

                return (
                  <div
                    key={dateStr}
                    className={`p-4 ${isPastDay ? 'bg-slate-50/80 opacity-70' : day.keinArbeitstag ? 'bg-slate-50/60' : isHolidayDay ? 'bg-slate-100/70' : ''}`}
                  >
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                      {/* Day label */}
                      <div className="w-28 flex-shrink-0 pt-1">
                        <div className="font-medium text-slate-900 text-sm">{DAY_NAMES[i]}</div>
                        <div className="text-xs text-slate-500">{formatDate(date)}</div>
                        {isHolidayDay && (
                          <div className="text-xs text-slate-500 italic mt-0.5">{holidayName}</div>
                        )}
                      </div>

                      {/* Checkbox */}
                      <div className="flex items-center gap-1.5 pt-1.5 flex-shrink-0">
                        <Checkbox
                          id={`nowork-${dateStr}`}
                          checked={day.keinArbeitstag}
                          onCheckedChange={(checked) => updateDayFlag(dateStr, !!checked)}
                          disabled={isPastDay}
                        />
                        <label
                          htmlFor={`nowork-${dateStr}`}
                          className="text-xs text-slate-500 cursor-pointer select-none whitespace-nowrap"
                        >
                          kein Arbeitstag
                        </label>
                      </div>

                      {/* Blocks or placeholder */}
                      {day.keinArbeitstag ? (
                        <div className="flex-1 flex items-center pt-1">
                          <span className="text-sm text-slate-400 italic">—</span>
                        </div>
                      ) : isHolidayDay ? (
                        <div className="flex-1 flex items-center pt-1">
                          <span className="text-xs text-slate-500 italic">
                            Gesetzlicher Feiertag ({holidayName}) – Planung nicht möglich.
                          </span>
                        </div>
                      ) : (
                        <div className="flex-1 space-y-2 min-w-0">
                          {day.blocks.map((block, blockIdx) => {
                            const blockError = dayErrors.find((e) => e.blockIndex === blockIdx)
                            const blockHours = calcHours(block.start, block.end)
                            return (
                              <div key={blockIdx}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-slate-500">Von</span>
                                    <Select
                                      value={block.start}
                                      onValueChange={(v) => updateBlock(dateStr, blockIdx, 'start', v)}
                                      disabled={isPastDay}
                                    >
                                      <SelectTrigger
                                        className={`w-24 text-sm h-9 ${blockError ? 'border-red-400 focus:ring-red-300' : ''}`}
                                      >
                                        <SelectValue placeholder="--:--" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TIME_OPTIONS.map((t) => (
                                          <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-slate-500">Bis</span>
                                    <Select
                                      value={block.end}
                                      onValueChange={(v) => updateBlock(dateStr, blockIdx, 'end', v)}
                                      disabled={isPastDay}
                                    >
                                      <SelectTrigger
                                        className={`w-24 text-sm h-9 ${blockError ? 'border-red-400 focus:ring-red-300' : ''}`}
                                      >
                                        <SelectValue placeholder="--:--" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TIME_OPTIONS.map((t) => (
                                          <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <span className="text-xs text-slate-500 tabular-nums min-w-[44px]">
                                    {blockHours > 0 ? formatHours(blockHours) : '–'}
                                  </span>
                                  {day.blocks.length > 1 && !isPastDay && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeBlock(dateStr, blockIdx)}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                                      aria-label="Block entfernen"
                                    >
                                      −
                                    </Button>
                                  )}
                                </div>
                                {blockError && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {blockError.message}
                                  </p>
                                )}
                              </div>
                            )
                          })}

                          {day.blocks.length < 3 && !isPastDay && (
                            <button
                              type="button"
                              onClick={() => addBlock(dateStr)}
                              disabled={!canAddBlock(day)}
                              className="text-xs text-blue-600 hover:text-blue-800 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1 mt-1"
                            >
                              + Block hinzufügen
                            </button>
                          )}

                          {day.blocks.length > 1 && dayHours > 0 && (
                            <div className="text-xs font-medium text-slate-600 pt-1.5 border-t border-slate-100">
                              Gesamt: {formatHours(dayHours)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
            disabled={saving || hasValidationErrors || allDaysPast}
            className="px-8"
          >
            {saving ? 'Speichern…' : 'Plan speichern'}
          </Button>
        </div>
      </main>
    </div>
  )
}
