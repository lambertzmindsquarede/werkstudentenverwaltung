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
import { createTimeEntry } from '@/app/manager/auswertung/correction-actions'

function generateTimeOptions(): string[] {
  const options: string[] = []
  for (let h = 0; h <= 23; h++) {
    for (let m = 0; m <= 45; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

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
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setStart('')
      setEnd('')
      setReason('')
      setError(null)
    }
  }, [open])

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
    const result = await createTimeEntry(userId, { date, actual_start: start, actual_end: end, reason: reason.trim() })
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
          <DialogTitle>Eintrag hinzufügen – {formatDateDE(date)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-slate-700">Startzeit</Label>
              <Select value={start} onValueChange={(v) => { setStart(v); setError(null) }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="HH:MM" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-slate-700">Endzeit</Label>
              <Select value={end} onValueChange={(v) => { setEnd(v); setError(null) }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="HH:MM" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
