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
import { Input } from '@/components/ui/input'
import { createTimeEntry } from '@/app/manager/auswertung/correction-actions'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTE_OPTIONS = ['00', '15', '30', '45']

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

interface Props {
  open: boolean
  date: string
  userId: string
  onClose: () => void
  onSaved: () => void
}

export default function ZeiteintragHinzufuegenDialog({ open, date, userId, onClose, onSaved }: Props) {
  const [selectedDate, setSelectedDate] = useState(date)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedDate(date)
      setStart('')
      setEnd('')
      setReason('')
      setError(null)
    }
  }, [open, date])

  const startAfterEnd = start && end && start >= end

  async function handleSave() {
    if (!selectedDate) {
      setError('Bitte ein Datum auswählen.')
      return
    }
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
    const result = await createTimeEntry(userId, { date: selectedDate, actual_start: start, actual_end: end, reason: reason.trim() })
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
          <DialogTitle>Eintrag hinzufügen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm text-slate-700">
              Datum <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setError(null) }}
              className="mt-1"
            />
          </div>

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
              placeholder="Warum wird dieser Eintrag nachgetragen?"
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
            {saving ? 'Hinzufügen…' : 'Hinzufügen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
