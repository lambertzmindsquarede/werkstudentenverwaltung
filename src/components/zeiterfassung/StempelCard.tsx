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
import type { ActualEntry } from '@/lib/database.types'
import { calcNetHours, checkArbZGWarning, timeToMinutes } from '@/lib/time-block-utils'
import { updateBreakMinutes } from '@/app/dashboard/actions'
import { usePublicHolidays } from '@/hooks/usePublicHolidays'
import { getBundeslandName } from '@/lib/bundesland-utils'

interface Props {
  todayEntries: ActualEntry[]
  today: string
  isWeekend: boolean
  bundesland: string
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

export default function StempelCard({
  todayEntries,
  today,
  isWeekend,
  bundesland,
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

  async function doStampIn() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/time-entries/stamp', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Einstempeln.')
      } else {
        onEntryChange(json.data as ActualEntry)
      }
    } catch {
      setError('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  function handleStampIn() {
    if (todayIsHoliday) {
      setShowHolidayDialog(true)
    } else {
      doStampIn()
    }
  }

  async function handleStampOut() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/time-entries/stamp', { method: 'PATCH' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Ausstempeln.')
      } else {
        const closedEntry = json.data as ActualEntry
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

          {error && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* Stamp button */}
          {atMaxBlocks ? (
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
          ) : canStampIn ? (
            <Button
              onClick={handleStampIn}
              disabled={loading}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? '…' : 'Einstempeln'}
            </Button>
          ) : null}
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
                doStampIn()
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
