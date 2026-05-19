'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import IstEintragEditDialog from './IstEintragEditDialog'
import EmojiPickerPopover from './EmojiPickerPopover'
import type { ActualEntry, AbsenceWithType } from '@/lib/database.types'
import { getAbsenceName, getAbsenceColor, getAbsenceAbbreviation } from '@/lib/database.types'
import { calcNetHours, checkArbZGWarning, timeToMinutes } from '@/lib/time-block-utils'
import { updateBreakMinutes, updateTodayArbeitsort } from '@/app/dashboard/actions'
import { usePublicHolidays } from '@/hooks/usePublicHolidays'
import { getBundeslandName } from '@/lib/bundesland-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  todayEntries: ActualEntry[]
  today: string
  isWeekend: boolean
  bundesland: string
  todayAbsence: AbsenceWithType | null
  arbeitsorte: { id: string; name: string }[]
  todayArbeitsortId: string | null
  hasTodayPlan: boolean
  onArbeitsortChange: (id: string | null) => void
  onEntryChange: (entry: ActualEntry) => void
  onEntryDeleted: (entryId: string) => void
}

function formatTime(time: string | null): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

function formatHours(h: number): string {
  return h.toFixed(1).replace('.', ',') + ' Std'
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

function getBerlinTimeRounded(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10)
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 5) * 5).padStart(2, '0')}`
}

function getCurrentBerlinHHMM(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  return `${parts.find(p => p.type === 'hour')!.value}:${parts.find(p => p.type === 'minute')!.value}`
}

export default function StempelCard({
  todayEntries,
  today,
  isWeekend,
  bundesland,
  todayAbsence,
  arbeitsorte,
  todayArbeitsortId,
  hasTodayPlan,
  onArbeitsortChange,
  onEntryChange,
  onEntryDeleted,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<ActualEntry | null>(null)
  const [breakQueryEntry, setBreakQueryEntry] = useState<ActualEntry | null>(null)
  const [breakInput, setBreakInput] = useState('')
  const [breakSaving, setBreakSaving] = useState(false)
  const [showHolidayDialog, setShowHolidayDialog] = useState(false)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)
  const [arbeitsortSaving, setArbeitsortSaving] = useState(false)
  const [stampMode, setStampMode] = useState<'idle' | 'in' | 'out'>('idle')
  const [stampTime, setStampTime] = useState('')

  async function handleArbeitsortChange(id: string) {
    const newId = id === '__none__' ? null : id
    setArbeitsortSaving(true)
    const result = await updateTodayArbeitsort(newId)
    setArbeitsortSaving(false)
    if (!result.error) {
      onArbeitsortChange(newId)
    }
  }

  const year = parseInt(today.slice(0, 4), 10)
  const { isHoliday, getHolidayName } = usePublicHolidays(bundesland, year)
  const todayIsHoliday = isHoliday(today)
  const todayHolidayName = getHolidayName(today)

  const completedBlocks = todayEntries.filter((e) => e.is_complete)
  const openBlock = todayEntries.find((e) => !e.is_complete) ?? null
  const atMaxBlocks = completedBlocks.length >= 3 && !openBlock
  const canStampIn = !openBlock && completedBlocks.length < 3

  const todayNetHours = completedBlocks.reduce(
    (sum, e) => sum + calcNetHours(e.actual_start, e.actual_end, e.break_minutes ?? 0),
    0
  )

  const totalBruttoMinutes = completedBlocks.reduce((sum, e) => {
    if (!e.actual_start || !e.actual_end) return sum
    return sum + (timeToMinutes(e.actual_end.slice(0, 5)) - timeToMinutes(e.actual_start.slice(0, 5)))
  }, 0)
  const totalBreakMinutes = completedBlocks.reduce((sum, e) => sum + (e.break_minutes ?? 0), 0)
  const arbZGWarning = completedBlocks.length > 0
    ? checkArbZGWarning(totalBruttoMinutes, totalBreakMinutes)
    : null

  const stampTimeValidationError = (() => {
    if (stampMode === 'idle') return null
    if (!stampTime) return 'Bitte eine Uhrzeit eingeben.'
    const now = getCurrentBerlinHHMM()
    const nowMins = timeToMinutes(now)
    const stampMins = timeToMinutes(stampTime)
    if (stampMode === 'out') {
      if (stampMins > nowMins + 5) return 'Ausstempelzeit darf maximal 5 Minuten in der Zukunft liegen.'
    } else {
      if (stampMins > nowMins) return 'Zeit darf nicht in der Zukunft liegen.'
    }
    if (stampMode === 'in') {
      const lastBlock = completedBlocks[completedBlocks.length - 1]
      if (lastBlock?.actual_end) {
        const lastEnd = lastBlock.actual_end.slice(0, 5)
        if (stampTime <= lastEnd) return `Zeit muss nach ${lastEnd} Uhr liegen.`
      }
    }
    if (stampMode === 'out' && openBlock?.actual_start) {
      const startMins = timeToMinutes(openBlock.actual_start.slice(0, 5))
      const enteredMins = timeToMinutes(stampTime)
      if (enteredMins - startMins < 1) {
        return `Zeit muss mindestens 1 Minute nach ${openBlock.actual_start.slice(0, 5)} Uhr liegen.`
      }
    }
    return null
  })()

  function openStampInPicker() {
    setStampMode('in')
    setStampTime(getBerlinTimeRounded())
    setError(null)
  }

  async function doStampIn(time: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/time-entries/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: selectedEmoji, time }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Einstempeln.')
      } else {
        setSelectedEmoji(null)
        setStampMode('idle')
        onEntryChange(json.data as ActualEntry)
      }
    } catch {
      setError('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  async function updateMoodEmoji(emoji: string | null) {
    try {
      const res = await fetch('/api/time-entries/mood-emoji', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      const json = await res.json()
      if (res.ok) {
        onEntryChange(json.data as ActualEntry)
      } else {
        setError('Stimmung konnte nicht gespeichert werden.')
      }
    } catch {
      setError('Stimmung konnte nicht gespeichert werden.')
    }
  }

  function handleStampIn() {
    if (todayIsHoliday) {
      setShowHolidayDialog(true)
    } else {
      openStampInPicker()
    }
  }

  function handleStampOut() {
    setStampMode('out')
    setStampTime(getBerlinTimeRounded())
    setError(null)
  }

  async function doStampOut(time: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/time-entries/stamp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Ausstempeln.')
      } else {
        const closedEntry = json.data as ActualEntry
        setStampMode('idle')
        onEntryChange(closedEntry)
        setBreakQueryEntry(closedEntry)
        setBreakInput('')
      }
    } catch {
      setError('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  async function saveBreak(minutes: number) {
    if (!breakQueryEntry) return
    setBreakSaving(true)
    const result = await updateBreakMinutes(breakQueryEntry.id, breakQueryEntry.date, minutes)
    setBreakSaving(false)
    if (result.data) {
      onEntryChange(result.data)
    }
    setBreakQueryEntry(null)
  }

  return (
    <>
      {todayAbsence && (
        <Alert className="mb-3 bg-rose-50 border-rose-200">
          <AlertDescription className="text-rose-800 text-sm flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: getAbsenceColor(todayAbsence) }}
            >
              {getAbsenceAbbreviation(todayAbsence)}
            </span>
            <span>
              <span className="font-medium">{getAbsenceName(todayAbsence)}</span>
              {' – du bist heute als abwesend eingetragen. Zeiterfassung ist gesperrt.'}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {todayIsHoliday && todayHolidayName && (
        <Alert className="mb-3 bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800 text-sm">
            <span className="font-medium">{todayHolidayName}</span>
            {' – heute ist ein gesetzlicher Feiertag in '}
            {getBundeslandName(bundesland)}.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-slate-200 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Zeiterfassung heute
          </CardDescription>
          <CardTitle className="text-lg text-slate-900 mt-1">
            {todayEntries.length === 0 && 'Noch nicht eingestempelt'}
            {openBlock && `Eingestempelt seit ${formatTime(openBlock.actual_start)} Uhr`}
            {!openBlock && completedBlocks.length > 0 && (
              <span className="flex items-center gap-2">
                {completedBlocks.length === 1
                  ? `${formatTime(completedBlocks[0].actual_start)} – ${formatTime(completedBlocks[0].actual_end)} Uhr`
                  : `${completedBlocks.length} Blöcke heute`}
                <Badge className="bg-green-100 text-green-700 border border-green-300 hover:bg-green-100 text-sm font-normal">
                  {formatHours(todayNetHours)}
                </Badge>
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {isWeekend && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-700 text-sm">
                Heute ist Wochenende – Eintrag möglich, wird als Sonderarbeit markiert.
              </AlertDescription>
            </Alert>
          )}

          {/* Completed blocks list */}
          {completedBlocks.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {completedBlocks.map((block) => {
                const netH = calcNetHours(block.actual_start, block.actual_end, block.break_minutes ?? 0)
                const hasBreak = (block.break_minutes ?? 0) > 0
                return (
                  <div
                    key={block.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-slate-700">
                        {formatTime(block.actual_start)} – {formatTime(block.actual_end)} Uhr
                      </span>
                      {hasBreak && (
                        <span className="text-xs text-slate-400">
                          Pause {block.break_minutes} Min · Netto {netH.toFixed(1).replace('.', ',')} Std
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-slate-500">
                        {formatHours(netH)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-400 hover:text-slate-700 px-2"
                        onClick={() => setEditEntry(block)}
                      >
                        Bearbeiten
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Open block indicator */}
          {openBlock && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm text-blue-700">
                Läuft seit {formatTime(openBlock.actual_start)} Uhr
              </span>
              <Badge className="bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-100">
                Aktiv
              </Badge>
            </div>
          )}

          {/* Active emoji + Arbeitsort in one row while stamped in */}
          {openBlock && (
            <div className="flex items-center gap-3 flex-wrap">
              <EmojiPickerPopover
                selected={openBlock.mood_emoji ?? null}
                onSelect={updateMoodEmoji}
                trigger={
                  openBlock.mood_emoji ? (
                    <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm hover:bg-slate-100 transition-colors">
                      <span className="text-xl leading-none">{openBlock.mood_emoji}</span>
                      <span className="text-slate-500 text-xs">Stimmung ändern</span>
                    </button>
                  ) : (
                    <button className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-sm text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors">
                      <span className="text-base leading-none">🙂</span>
                      <span className="text-xs">Stimmung setzen</span>
                    </button>
                  )
                }
              />
              {arbeitsorte.length > 0 && hasTodayPlan && !todayAbsence && (
                <Select
                  value={todayArbeitsortId ?? ''}
                  onValueChange={handleArbeitsortChange}
                  disabled={arbeitsortSaving}
                >
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue placeholder="Arbeitsort wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {arbeitsorte.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* ArbZG warning */}
          {arbZGWarning && !openBlock && !breakQueryEntry && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertDescription className="text-amber-700 text-sm">
                {arbZGWarning}
              </AlertDescription>
            </Alert>
          )}

          {/* Inline break query after stamp-out */}
          {breakQueryEntry && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <p className="text-sm text-slate-700 font-medium">Haben Sie heute eine Pause gemacht?</p>
              <div className="flex items-center gap-2">
                <Label htmlFor="break-input" className="text-sm text-slate-600 whitespace-nowrap">
                  Pause (Min):
                </Label>
                <Input
                  id="break-input"
                  type="number"
                  min={0}
                  max={480}
                  value={breakInput}
                  onChange={(e) => setBreakInput(e.target.value)}
                  className="w-24"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveBreak(0)}
                  disabled={breakSaving}
                >
                  Überspringen
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const minutes = Math.max(0, Math.floor(Number(breakInput) || 0))
                    saveBreak(minutes)
                  }}
                  disabled={breakSaving}
                >
                  {breakSaving ? 'Speichern…' : 'Speichern'}
                </Button>
              </div>
            </div>
          )}

          {/* Arbeitsort selector when not stamped in */}
          {!openBlock && arbeitsorte.length > 0 && hasTodayPlan && !todayAbsence && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">Arbeitsort:</span>
              <Select
                value={todayArbeitsortId ?? ''}
                onValueChange={handleArbeitsortChange}
                disabled={arbeitsortSaving}
              >
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="Arbeitsort wählen" />
                </SelectTrigger>
                <SelectContent>
                  {arbeitsorte.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* Inline time picker – stamp in */}
          {stampMode === 'in' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
              <p className="text-sm font-medium text-slate-700">Einstempelzeit eingeben</p>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-slate-600 whitespace-nowrap">Uhrzeit:</Label>
                <Select
                  value={stampTime.slice(0, 2)}
                  onValueChange={(h) => setStampTime(`${h}:${stampTime.slice(3, 5)}`)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-slate-500 font-medium">:</span>
                <Select
                  value={stampTime.slice(3, 5)}
                  onValueChange={(m) => setStampTime(`${stampTime.slice(0, 2)}:${m}`)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {stampTimeValidationError && (
                <Alert className="border-red-300 bg-red-50 py-2">
                  <AlertDescription className="text-red-700 text-xs">
                    {stampTimeValidationError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => doStampIn(stampTime)}
                  disabled={loading || !!stampTimeValidationError || !stampTime}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? '…' : 'Jetzt einstempeln'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStampMode('idle')}
                  disabled={loading}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* Inline time picker – stamp out */}
          {stampMode === 'out' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <p className="text-sm font-medium text-slate-700">Ausstempelzeit eingeben</p>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-slate-600 whitespace-nowrap">Uhrzeit:</Label>
                <Select
                  value={stampTime.slice(0, 2)}
                  onValueChange={(h) => setStampTime(`${h}:${stampTime.slice(3, 5)}`)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-slate-500 font-medium">:</span>
                <Select
                  value={stampTime.slice(3, 5)}
                  onValueChange={(m) => setStampTime(`${stampTime.slice(0, 2)}:${m}`)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {stampTimeValidationError && (
                <Alert className="border-red-300 bg-red-50 py-2">
                  <AlertDescription className="text-red-700 text-xs">
                    {stampTimeValidationError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => doStampOut(stampTime)}
                  disabled={loading || !!stampTimeValidationError || !stampTime}
                  className="bg-slate-700 hover:bg-slate-800 text-white"
                >
                  {loading ? '…' : 'Jetzt ausstempeln'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStampMode('idle')}
                  disabled={loading}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* Stamp button (hidden while time picker is open) */}
          {stampMode === 'idle' && (
            atMaxBlocks ? (
              <div>
                <Button disabled size="lg" className="bg-slate-200 text-slate-400 cursor-not-allowed">
                  Einstempeln
                </Button>
                <p className="text-xs text-slate-400 mt-1.5">
                  Maximum 3 Blöcke pro Tag erreicht.
                </p>
              </div>
            ) : openBlock ? (
              <Button
                onClick={handleStampOut}
                disabled={loading}
                size="lg"
                className="bg-slate-700 hover:bg-slate-800 text-white"
              >
                {loading ? '…' : 'Ausstempeln'}
              </Button>
            ) : todayAbsence ? (
              <div>
                <Button disabled size="lg" className="bg-slate-200 text-slate-400 cursor-not-allowed">
                  Einstempeln
                </Button>
                <p className="text-xs text-slate-400 mt-1.5">
                  Abwesenheit eingetragen – Einstempeln nicht möglich.
                </p>
              </div>
            ) : canStampIn ? (
              <div className="flex items-center gap-2">
                <EmojiPickerPopover
                  selected={selectedEmoji}
                  onSelect={setSelectedEmoji}
                  trigger={
                    selectedEmoji ? (
                      <button
                        className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-sm hover:bg-blue-100 transition-colors"
                        title="Stimmung ändern"
                      >
                        <span className="text-xl leading-none">{selectedEmoji}</span>
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-2 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors"
                        title="Stimmung auswählen (optional)"
                      >
                        <span className="text-xl leading-none">🙂</span>
                      </button>
                    )
                  }
                />
                <Button
                  onClick={handleStampIn}
                  disabled={loading}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? '…' : 'Einstempeln'}
                </Button>
              </div>
            ) : null
          )}
        </CardContent>
      </Card>

      {editEntry && (
        <IstEintragEditDialog
          open
          date={editEntry.date}
          entry={editEntry}
          otherEntries={todayEntries.filter((e) => e.id !== editEntry.id)}
          onClose={() => setEditEntry(null)}
          onSaved={(updated) => {
            onEntryChange(updated)
            setEditEntry(null)
          }}
          onDeleted={(id) => {
            onEntryDeleted(id)
            setEditEntry(null)
          }}
        />
      )}

      <AlertDialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Heute ist ein Feiertag</AlertDialogTitle>
            <AlertDialogDescription>
              Achtung: Heute ist {todayHolidayName ?? 'ein gesetzlicher Feiertag'}. Bitte stelle
              sicher, dass dein Einsatz genehmigt ist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowHolidayDialog(false)
                openStampInPicker()
              }}
            >
              Trotzdem einstempeln
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
