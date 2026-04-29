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
import { createClient } from '@/lib/supabase-browser'
import type { ActualEntry } from '@/lib/database.types'

interface Props {
  open: boolean
  date: string
  entry: ActualEntry | null
  onClose: () => void
  onSaved: (entry: ActualEntry) => void
}

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export default function IstEintragEditDialog({ open, date, entry, onClose, onSaved }: Props) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awaitingLongDayConfirm, setAwaitingLongDayConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      setStart(entry?.actual_start?.slice(0, 5) ?? '')
      setEnd(entry?.actual_end?.slice(0, 5) ?? '')
      setError(null)
      setAwaitingLongDayConfirm(false)
    }
  }, [open, entry])

  const startAfterEnd = start && end && timeToMinutes(start) >= timeToMinutes(end)
  const hours =
    start && end && !startAfterEnd ? (timeToMinutes(end) - timeToMinutes(start)) / 60 : 0
  const isLongDay = hours > 10

  async function handleSave() {
    if (!start || !end) {
      setError('Bitte Start- und Endzeit eingeben.')
      return
    }
    if (startAfterEnd) {
      setError('Startzeit muss vor der Endzeit liegen.')
      return
    }
    if (isLongDay && !awaitingLongDayConfirm) {
      setAwaitingLongDayConfirm(true)
      return
    }

    setSaving(true)
    setError(null)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Nicht angemeldet.')
      setSaving(false)
      return
    }

    if (entry) {
      const { data, error: dbError } = await supabase
        .from('actual_entries')
        .update({ actual_start: start + ':00', actual_end: end + ':00', is_complete: true })
        .eq('id', entry.id)
        .select()
        .single()
      if (dbError || !data) {
        setError(dbError?.message ?? 'Speichern fehlgeschlagen.')
      } else {
        onSaved(data as unknown as ActualEntry)
      }
    } else {
      const { data, error: dbError } = await supabase
        .from('actual_entries')
        .insert({
          user_id: user.id,
          date,
          actual_start: start + ':00',
          actual_end: end + ':00',
          is_complete: true,
        })
        .select()
        .single()
      if (dbError || !data) {
        setError(dbError?.message ?? 'Speichern fehlgeschlagen.')
      } else {
        onSaved(data as unknown as ActualEntry)
      }
    }

    setSaving(false)
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

          {startAfterEnd && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">
                Startzeit muss vor der Endzeit liegen.
              </AlertDescription>
            </Alert>
          )}

          {awaitingLongDayConfirm && !startAfterEnd && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertDescription className="text-amber-700 text-sm">
                Ungewöhnlich langer Arbeitstag ({hours.toFixed(1).replace('.', ',')}h) – bitte
                bestätigen.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !!startAfterEnd}>
            {saving ? 'Speichern…' : awaitingLongDayConfirm ? 'Trotzdem speichern' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
