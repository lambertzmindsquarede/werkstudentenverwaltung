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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { deleteTimeEntry } from '@/app/manager/auswertung/correction-actions'
import type { IstEintragDetail } from '@/app/manager/auswertung/actions'

function formatTime(t: string | null): string {
  if (!t) return '—'
  return t.slice(0, 5)
}

interface Props {
  open: boolean
  date: string
  userId: string
  entry: IstEintragDetail
  onClose: () => void
  onDeleted: () => void
}

export default function ZeiteintragLoeschenDialog({ open, date, userId, entry, onClose, onDeleted }: Props) {
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])

  const [y, m, d] = date.split('-')
  const dateDE = `${d}.${m}.${y}`

  async function handleDelete() {
    if (!reason.trim()) {
      setError('Bitte eine Begründung eingeben.')
      return
    }

    setDeleting(true)
    setError(null)
    const result = await deleteTimeEntry(entry.id, userId, { reason: reason.trim() })
    setDeleting(false)

    if (result.error) {
      setError(result.error)
    } else {
      onDeleted()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eintrag löschen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-medium">{dateDE}</div>
            <div className="text-slate-500 mt-0.5">
              {formatTime(entry.actual_start)} – {formatTime(entry.actual_end)} Uhr
            </div>
          </div>

          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700 text-sm">
              Dieser Zeiteintrag wird unwiderruflich gelöscht.
            </AlertDescription>
          </Alert>

          <div>
            <Label className="text-sm text-slate-700">
              Begründung <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null) }}
              placeholder="Warum wird dieser Eintrag gelöscht?"
              maxLength={200}
              rows={3}
              className="mt-1 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{reason.length}/200</p>
          </div>

          {error && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Löschen…' : 'Löschen bestätigen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
