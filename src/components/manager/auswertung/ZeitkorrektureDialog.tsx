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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateTimeEntry } from '@/app/manager/auswertung/correction-actions'
import type { IstEintragDetail } from '@/app/manager/auswertung/actions'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTE_OPTIONS = ['00', '15', '30', '45']

function roundDownTo15(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const mm = Math.floor(m / 15) * 15
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function roundUpTo15(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const mm = Math.ceil(m / 15) * 15
  if (mm === 60) {
    return `${String((h + 1) % 24).padStart(2, '0')}:00`
  }
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

interface Props {
  open: boolean
  date: string
  userId: string
  entry: IstEintragDetail
  onClose: () => void
  onSaved: () => void
}

export default function ZeitkorrektureDialog({ open, date, userId, entry, onClose, onSaved }: Props) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setStart(entry.actual_start ? roundDownTo15(entry.actual_start.slice(0, 5)) : '')
      setEnd(entry.actual_end ? roundUpTo15(entry.actual_end.slice(0, 5)) : '')
      setReason('')
      setError(null)
    }
  }, [open, entry])

  const startAfterEnd = start && end && start >= end

  async function handleSave() {
    if (!start || !end) {
      setError('Bitte Start- und Endzeit auswählen.')
      return
    }
    if (startAfterEnd) {
      setError('Startzeit muss vor der Endzeit liegen.')
      return
    }
    if (!reason.trim()) {
      setError('Bitte eine Begründung eingeben.')
      return
    }

    setSaving(true)
    setError(null)
    const result = await updateTimeEntry(entry.id, userId, { actual_start: start, actual_end: end, reason: reason.trim() })
    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eintrag bearbeiten – {formatDateDE(date)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-slate-700">Startzeit</Label>
              <div className="flex items-center gap-1 mt-1">
                <Select
                  value={start.length === 5 ? start.slice(0, 2) : ''}
                  onValueChange={(h) => { setStart(start.length === 5 ? `${h}:${start.slice(3, 5)}` : `${h}:00`); setError(null) }}
                >
                  <SelectTrigger className="w-16">
                    <SelectValue placeholder="hh" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-slate-500 font-medium">:</span>
                <Select
                  value={start.length === 5 ? start.slice(3, 5) : ''}
                  onValueChange={(m) => { setStart(start.length === 5 ? `${start.slice(0, 2)}:${m}` : `00:${m}`); setError(null) }}
                >
                  <SelectTrigger className="w-16">
                    <SelectValue placeholder="mm" />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm text-slate-700">Endzeit</Label>
              <div className="flex items-center gap-1 mt-1">
                <Select
                  value={end.length === 5 ? end.slice(0, 2) : ''}
                  onValueChange={(h) => { setEnd(end.length === 5 ? `${h}:${end.slice(3, 5)}` : `${h}:00`); setError(null) }}
                >
                  <SelectTrigger className="w-16">
                    <SelectValue placeholder="hh" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-slate-500 font-medium">:</span>
                <Select
                  value={end.length === 5 ? end.slice(3, 5) : ''}
                  onValueChange={(m) => { setEnd(end.length === 5 ? `${end.slice(0, 2)}:${m}` : `00:${m}`); setError(null) }}
                >
                  <SelectTrigger className="w-16">
                    <SelectValue placeholder="mm" />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm text-slate-700">
              Begründung <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null) }}
              placeholder="Warum wird dieser Eintrag korrigiert?"
              maxLength={200}
              rows={3}
              className="mt-1 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{reason.length}/200</p>
          </div>

          {startAfterEnd && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">
                Startzeit muss vor der Endzeit liegen.
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
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
