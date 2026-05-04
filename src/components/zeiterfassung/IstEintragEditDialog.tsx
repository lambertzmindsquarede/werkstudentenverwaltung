'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ActualEntry } from '@/lib/database.types'
import {
  updateActualEntry,
  insertActualEntry,
  deleteActualEntry,
} from '@/app/dashboard/actions'
import { validateBlocks, calcNetHours, checkArbZGWarning, timeToMinutes } from '@/lib/time-block-utils'

interface Props {
  open: boolean
  date: string
  entry: ActualEntry | null
  otherEntries?: ActualEntry[]
  onClose: () => void
  onSaved: (entry: ActualEntry) => void
  onDeleted?: (entryId: string) => void
}

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

export default function IstEintragEditDialog({
  open,
  date,
  entry,
  otherEntries = [],
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [breakMinutes, setBreakMinutes] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awaitingLongDayConfirm, setAwaitingLongDayConfirm] = useState(false)
  const [awaitingDeleteConfirm, setAwaitingDeleteConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      setStart(entry?.actual_start?.slice(0, 5) ?? '')
      setEnd(entry?.actual_end?.slice(0, 5) ?? '')
      setBreakMinutes(entry?.break_minutes ?? 0)
      setError(null)
      setAwaitingLongDayConfirm(false)
      setAwaitingDeleteConfirm(false)
    }
  }, [open, entry])

  const startAfterEnd = start && end && timeToMinutes(start) >= timeToMinutes(end)
  const grossMinutes =
    start && end && !startAfterEnd ? timeToMinutes(end) - timeToMinutes(start) : 0
  const hours = grossMinutes / 60
  const isLongDay = hours > 10
  const breakExceedsDuration = breakMinutes > 0 && grossMinutes > 0 && breakMinutes >= grossMinutes
  const netHours = calcNetHours(start || null, end || null, breakMinutes)

  // Overlap validation against other entries for the same day
  const otherCompletedBlocks = otherEntries
    .filter((e) => e.is_complete && e.actual_start && e.actual_end)
    .map((e) => ({
      start: e.actual_start!.slice(0, 5),
      end: e.actual_end!.slice(0, 5),
    }))
  const overlapErrors =
    start && end && !startAfterEnd
      ? validateBlocks([...otherCompletedBlocks, { start, end }]).filter(
          (e) => e.blockIndex === otherCompletedBlocks.length
        )
      : []
  const hasOverlap = overlapErrors.length > 0

  // ArbZG warning: computed against all day's blocks (this block + other completed)
  const otherBruttoMinutes = otherEntries
    .filter((e) => e.is_complete && e.actual_start && e.actual_end)
    .reduce((sum, e) => sum + (timeToMinutes(e.actual_end!.slice(0, 5)) - timeToMinutes(e.actual_start!.slice(0, 5))), 0)
  const otherBreakMinutes = otherEntries
    .filter((e) => e.is_complete)
    .reduce((sum, e) => sum + (e.break_minutes ?? 0), 0)
  const totalBruttoMinutes = otherBruttoMinutes + grossMinutes
  const totalBreakMinutes = otherBreakMinutes + breakMinutes
  const arbZGWarning = checkArbZGWarning(totalBruttoMinutes, totalBreakMinutes)

  const canSave = !startAfterEnd && !hasOverlap && !breakExceedsDuration

  async function handleSave() {
    if (!start || !end) {
      setError('Bitte Start- und Endzeit eingeben.')
      return
    }
    if (startAfterEnd) {
      setError('Startzeit muss vor der Endzeit liegen.')
      return
    }
    if (hasOverlap) {
      setError('Dieser Zeitblock überschneidet sich mit einem anderen Block des Tages.')
      return
    }
    if (breakExceedsDuration) {
      setError('Pause darf die Blockdauer nicht überschreiten.')
      return
    }
    if (isLongDay && !awaitingLongDayConfirm) {
      setAwaitingLongDayConfirm(true)
      return
    }

    setSaving(true)
    setError(null)

    let result: { error?: string; data?: ActualEntry }
    if (entry) {
      result = await updateActualEntry(entry.id, {
        date,
        actual_start: start + ':00',
        actual_end: end + ':00',
        break_minutes: breakMinutes,
      })
    } else {
      result = await insertActualEntry({
        date,
        actual_start: start + ':00',
        actual_end: end + ':00',
        break_minutes: breakMinutes,
      })
    }

    setSaving(false)
    if (result.error || !result.data) {
      setError(result.error ?? 'Speichern fehlgeschlagen.')
    } else {
      onSaved(result.data)
    }
  }

  async function handleDelete() {
    if (!entry) return
    if (!awaitingDeleteConfirm) {
      setAwaitingDeleteConfirm(true)
      return
    }

    setDeleting(true)
    setError(null)
    const { error: deleteError } = await deleteActualEntry(entry.id, entry.date)
    setDeleting(false)
    if (deleteError) {
      setError(deleteError)
      setAwaitingDeleteConfirm(false)
    } else {
      onDeleted?.(entry.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Zeiten bearbeiten – {formatDateDE(date)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ist-start" className="text-sm text-slate-700">
                Startzeit
              </Label>
              <Input
                id="ist-start"
                type="time"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value)
                  setAwaitingLongDayConfirm(false)
                  setError(null)
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ist-end" className="text-sm text-slate-700">
                Endzeit
              </Label>
              <Input
                id="ist-end"
                type="time"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value)
                  setAwaitingLongDayConfirm(false)
                  setError(null)
                }}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ist-break" className="text-sm text-slate-700">
              Pause (Min)
            </Label>
            <Input
              id="ist-break"
              type="number"
              min={0}
              max={480}
              value={breakMinutes}
              onChange={(e) => {
                const val = Math.max(0, Math.floor(Number(e.target.value) || 0))
                setBreakMinutes(val)
                setError(null)
              }}
              className="mt-1"
            />
            {grossMinutes > 0 && !startAfterEnd && !breakExceedsDuration && (
              <p className="text-xs text-slate-500 mt-1">
                Netto: {netHours.toFixed(1).replace('.', ',')} Std
              </p>
            )}
          </div>

          {startAfterEnd && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">
                Startzeit muss vor der Endzeit liegen.
              </AlertDescription>
            </Alert>
          )}

          {hasOverlap && !startAfterEnd && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">
                Dieser Block überschneidet sich mit einem anderen Block des Tages.
              </AlertDescription>
            </Alert>
          )}

          {breakExceedsDuration && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">
                Pause darf die Blockdauer nicht überschreiten.
              </AlertDescription>
            </Alert>
          )}

          {awaitingLongDayConfirm && !startAfterEnd && !hasOverlap && !breakExceedsDuration && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertDescription className="text-amber-700 text-sm">
                Ungewöhnlich langer Arbeitstag ({hours.toFixed(1).replace('.', ',')}h) – bitte
                bestätigen.
              </AlertDescription>
            </Alert>
          )}

          {awaitingDeleteConfirm && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">
                Block wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDescription>
            </Alert>
          )}

          {arbZGWarning && !startAfterEnd && !breakExceedsDuration && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertDescription className="text-amber-700 text-sm">
                {arbZGWarning}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {entry && onDeleted && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                {deleting ? 'Löschen…' : awaitingDeleteConfirm ? 'Wirklich löschen' : 'Löschen'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || deleting || !canSave}
            >
              {saving
                ? 'Speichern…'
                : awaitingLongDayConfirm
                ? 'Trotzdem speichern'
                : 'Speichern'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
