'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import WerkstudentNav from '@/components/werkstudent/WerkstudentNav'
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
import type { Arbeitsort } from '@/lib/database.types'
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
import type { AbsenceWithType, ResolvedAbsenceType } from '@/lib/database.types'
import { getAbsenceName, getAbsenceColor, getAbsenceAbbreviation } from '@/lib/database.types'
import AbwesenheitDialog from './AbwesenheitDialog'

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
  arbeitsortId: string | null
}

interface Props {
  weekStr: string
  initialEntries: DayEntry[]
  weeklyHourLimit: number
  bundesland: string
  arbeitsorte: Arbeitsort[]
  lastUsedArbeitsortId: string | null
  initialAbsences: AbsenceWithType[]
  absenceTypes: ResolvedAbsenceType[]
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

function buildInitialState(
  entries: DayEntry[],
  weekDates: Date[],
  lastUsedArbeitsortId: string | null,
  activeArbeitsortIds: Set<string>
): Record<string, DayState> {
  const entriesByDate = new Map<string, DayEntry[]>()
  for (const e of entries) {
    if (!entriesByDate.has(e.date)) entriesByDate.set(e.date, [])
    entriesByDate.get(e.date)!.push(e)
  }

  // Only use lastUsedArbeitsortId if it still refers to an active Arbeitsort
  const resolvedLastUsed =
    lastUsedArbeitsortId && activeArbeitsortIds.has(lastUsedArbeitsortId)
      ? lastUsedArbeitsortId
      : null

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
      const arbeitsortId = dayEntries[0]?.arbeitsort_id ?? resolvedLastUsed ?? null
      return [dateStr, { keinArbeitstag: false, blocks, arbeitsortId }]
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
  arbeitsorte,
  lastUsedArbeitsortId,
  initialAbsences,
  absenceTypes,
}: Props) {
  const router = useRouter()
  const weekDates = getWeekDates(weekStr)
  const today = useMemo(() => new Date().toLocaleDateString('sv', { timeZone: 'Europe/Berlin' }), [])
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
    buildInitialState(initialEntries, weekDates, lastUsedArbeitsortId, new Set(arbeitsorte.map((a) => a.id)))
  )
  const [templateLoaded, setTemplateLoaded] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [absencesByDate, setAbsencesByDate] = useState<Record<string, AbsenceWithType>>(() => {
    const map: Record<string, AbsenceWithType> = {}
    for (const a of initialAbsences) {
      map[a.date] = a
    }
    return map
  })
  const [absenceDialogDate, setAbsenceDialogDate] = useState<string | null>(null)

  const isAbsent = (dateStr: string) => !!absencesByDate[dateStr]

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

  const activeArbeitsortIds = new Set(arbeitsorte.map((a) => a.id))
  const arbeitsortMissingDays = arbeitsorte.length > 0
    ? weekDates.filter((date) => {
        const dateStr = dateToString(date)
        if (isPast(dateStr)) return false
        const day = dayStates[dateStr]
        if (!day || day.keinArbeitstag) return false
        const hasBlocks = day.blocks.some((b) => b.start && b.end)
        return hasBlocks && (!day.arbeitsortId || day.arbeitsortId.startsWith('__deactivated__'))
      }).map(dateToString)
    : []
  const hasArbeitsortMissing = arbeitsortMissingDays.length > 0

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

  function updateArbeitsortId(dateStr: string, arbeitsortId: string) {
    setDayStates((prev) => ({ ...prev, [dateStr]: { ...prev[dateStr], arbeitsortId } }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const entries: DayEntry[] = []
    weekDates.forEach((date) => {
      const dateStr = dateToString(date)
      if (isPast(dateStr)) return
      if (isHoliday(dateStr)) return
      const day = dayStates[dateStr]
      if (!day || day.keinArbeitstag) return
      day.blocks.forEach((block, i) => {
        if (block.start && block.end) {
          entries.push({
            date: dateStr,
            planned_start: block.start,
            planned_end: block.end,
            block_index: i + 1,
            arbeitsort_id: day.arbeitsortId ?? null,
          })
        }
      })
    })

    if (arbeitsorte.length > 0) {
      const missingArbeitsort = weekDates.some((date) => {
        const dateStr = dateToString(date)
        if (isPast(dateStr)) return false
        const day = dayStates[dateStr]
        if (!day || day.keinArbeitstag) return false
        const hasBlocks = day.blocks.some((b) => b.start && b.end)
        return hasBlocks && !day.arbeitsortId
      })
      if (missingArbeitsort) {
        setSaveError('Bitte für jeden Arbeitstag einen Arbeitsort auswählen.')
        setSaving(false)
        return
      }
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
        if (isHoliday(dateStr)) return
        const dayEntries = templateByDayIndex.get(i)
        if (dayEntries && dayEntries.length > 0) {
          const sorted = dayEntries.sort((a, b) => a.block_index - b.block_index)
          const blocks = sorted.map((e) => ({
            start: e.planned_start ? roundToQuarterHour(e.planned_start) : '',
            end: e.planned_end ? roundToQuarterHour(e.planned_end) : '',
          }))
          const templateArbeitsortId = sorted[0]?.arbeitsort_id ?? null
          const activeIds = new Set(arbeitsorte.map((a) => a.id))
          const arbeitsortId =
            templateArbeitsortId && activeIds.has(templateArbeitsortId)
              ? templateArbeitsortId
              : templateArbeitsortId
              ? `__deactivated__${templateArbeitsortId}`
              : null
          next[dateStr] = { keinArbeitstag: false, blocks, arbeitsortId }
        }
      })
      return next
    })

    setTemplateLoaded(true)
    toast.success('Vorlage der Vorwoche übernommen')
  }

  function navigateWeek(newWeekStr: string) {
    router.push(`/dashboard/wochenplanung?week=${newWeekStr}`)
  }

  const kwNumber = getCalendarWeekNumber(weekStr)
  const dateRange = getWeekDateRange(weekStr)

  return (
    <div className="min-h-screen bg-slate-50">
      <WerkstudentNav />

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
                const isAbsentDay = isAbsent(dateStr)
                const absence = absencesByDate[dateStr] ?? null

                return (
                  <div
                    key={dateStr}
                    className={`p-4 ${isPastDay ? 'bg-slate-50/80 opacity-70' : isAbsentDay ? 'bg-rose-50/60' : day.keinArbeitstag ? 'bg-slate-50/60' : isHolidayDay ? 'bg-amber-50' : ''}`}
                  >
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                      {/* Day label */}
                      <div className="w-28 flex-shrink-0 pt-1">
                        <div className="font-medium text-slate-900 text-sm">{DAY_NAMES[i]}</div>
                        <div className="text-xs text-slate-500">{formatDate(date)}</div>
                        {isHolidayDay && (
                          <div className="text-xs text-amber-700 font-medium mt-1 bg-amber-100 rounded px-1 py-0.5 inline-block">
                            🗓 {holidayName}
                          </div>
                        )}
                        {isAbsentDay && absence && (
                          <button
                            type="button"
                            onClick={() => setAbsenceDialogDate(dateStr)}
                            className="mt-1 flex items-center gap-1 text-xs font-medium rounded px-1.5 py-0.5 text-white"
                            style={{ backgroundColor: getAbsenceColor(absence) }}
                            aria-label={`Abwesenheit: ${getAbsenceName(absence)}`}
                          >
                            <span>{getAbsenceAbbreviation(absence)}</span>
                            <span className="truncate max-w-[72px]">{getAbsenceName(absence)}</span>
                          </button>
                        )}
                      </div>

                      {/* Checkbox */}
                      <div className="flex items-center gap-1.5 pt-1.5 flex-shrink-0">
                        <Checkbox
                          id={`nowork-${dateStr}`}
                          checked={day.keinArbeitstag}
                          onCheckedChange={(checked) => updateDayFlag(dateStr, !!checked)}
                          disabled={isPastDay || isAbsentDay}
                        />
                        <label
                          htmlFor={`nowork-${dateStr}`}
                          className="text-xs text-slate-500 cursor-pointer select-none whitespace-nowrap"
                        >
                          kein Arbeitstag
                        </label>
                      </div>

                      {/* Blocks or placeholder */}
                      {isAbsentDay ? (
                        <div className="flex-1 flex items-center justify-between pt-1">
                          <span className="text-sm text-rose-600 font-medium italic">
                            Abwesend – Planung gesperrt
                          </span>
                          <button
                            type="button"
                            onClick={() => setAbsenceDialogDate(dateStr)}
                            className="text-xs text-rose-600 hover:text-rose-800 underline underline-offset-2"
                          >
                            Details / Löschen
                          </button>
                        </div>
                      ) : day.keinArbeitstag ? (
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
                          {/* Arbeitsort dropdown */}
                          {arbeitsorte.length > 0 && !isPastDay && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500 flex-shrink-0">Ort</span>
                              <Select
                                value={
                                  day.arbeitsortId?.startsWith('__deactivated__')
                                    ? day.arbeitsortId
                                    : (day.arbeitsortId ?? '')
                                }
                                onValueChange={(v) => updateArbeitsortId(dateStr, v)}
                              >
                                <SelectTrigger
                                  className={`h-8 text-xs flex-1 max-w-[200px] ${
                                    arbeitsortMissingDays.includes(dateStr)
                                      ? 'border-red-400 focus:ring-red-300'
                                      : ''
                                  }`}
                                >
                                  <SelectValue placeholder="Arbeitsort wählen…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {arbeitsorte.map((ort) => (
                                    <SelectItem key={ort.id} value={ort.id}>
                                      {ort.name}
                                    </SelectItem>
                                  ))}
                                  {day.arbeitsortId?.startsWith('__deactivated__') && (
                                    <SelectItem
                                      value={day.arbeitsortId}
                                      disabled
                                      className="text-red-500"
                                    >
                                      (deaktiviert – bitte neu wählen)
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {arbeitsorte.length === 0 && !isPastDay && (
                            <p className="text-xs text-amber-600">
                              Ihr Manager hat noch keine Arbeitsorte hinterlegt.
                            </p>
                          )}
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

                          {!isPastDay && !isHolidayDay && (
                            <button
                              type="button"
                              onClick={() => setAbsenceDialogDate(dateStr)}
                              className="text-xs text-slate-400 hover:text-rose-600 transition-colors mt-1.5"
                            >
                              + Abwesenheit eintragen
                            </button>
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
            disabled={saving || hasValidationErrors || allDaysPast || hasArbeitsortMissing}
            className="px-8"
          >
            {saving ? 'Speichern…' : 'Plan speichern'}
          </Button>
        </div>
      </main>

      {absenceDialogDate && (
        <AbwesenheitDialog
          date={absenceDialogDate}
          absence={absencesByDate[absenceDialogDate] ?? null}
          absenceTypes={absenceTypes}
          onCreated={(created) => {
            setAbsencesByDate((prev) => ({ ...prev, [absenceDialogDate]: created }))
          }}
          onDeleted={() => {
            setAbsencesByDate((prev) => {
              const next = { ...prev }
              delete next[absenceDialogDate]
              return next
            })
          }}
          onClose={() => setAbsenceDialogDate(null)}
        />
      )}
    </div>
  )
}
