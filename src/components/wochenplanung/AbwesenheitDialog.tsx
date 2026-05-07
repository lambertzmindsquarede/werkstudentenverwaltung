'use client'

import { useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import type { AbsenceWithType, ResolvedAbsenceType } from '@/lib/database.types'
import {
  getAbsenceName,
  getAbsenceColor,
  getAbsenceAbbreviation,
} from '@/lib/database.types'
import { createAbsence, deleteAbsence } from '@/app/dashboard/wochenplanung/absence-actions'

interface Props {
  date: string
  absence: AbsenceWithType | null
  absenceTypes: ResolvedAbsenceType[]
  onCreated: (absence: AbsenceWithType) => void
  onDeleted: () => void
  onClose: () => void
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function AbwesenheitDialog({
  date,
  absence,
  absenceTypes,
  onCreated,
  onDeleted,
  onClose,
}: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    absenceTypes[0]?.id ?? ''
  )
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })
  const canDelete = absence && absence.date >= sevenDaysAgoStr

  async function handleCreate() {
    if (!selectedTypeId) {
      setError('Bitte einen Abwesenheitstyp wählen.')
      return
    }
    const selectedType = absenceTypes.find((t) => t.id === selectedTypeId)
    if (!selectedType) {
      setError('Ungültiger Typ gewählt.')
      return
    }

    setSaving(true)
    setError(null)

    const result = await createAbsence({
      date,
      typeId: selectedTypeId,
      isOverrideType: selectedType.is_override,
      note: note.trim() || null,
      typeName: selectedType.name,
      typeColor: selectedType.color,
      typeAbbreviation: selectedType.abbreviation,
    })

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.data) {
      onCreated(result.data)
    } else {
      // Fallback: create a synthetic absence with the selected type info
      const synthetic: AbsenceWithType = {
        id: 'temp-' + Date.now(),
        user_id: '',
        bereich_id: null,
        absence_type_id: selectedType.is_override ? null : (selectedType.id.startsWith('default-') ? null : selectedType.id),
        absence_type_override_id: selectedType.is_override ? selectedType.id : null,
        date,
        note: note.trim() || null,
        created_at: new Date().toISOString(),
        absence_type: selectedType.is_override ? null : {
          id: selectedType.id,
          name: selectedType.name,
          color: selectedType.color,
          abbreviation: selectedType.abbreviation,
        },
        absence_type_override: selectedType.is_override ? {
          id: selectedType.id,
          name: selectedType.name,
          color: selectedType.color,
          abbreviation: selectedType.abbreviation,
        } : null,
      }
      onCreated(synthetic)
    }
    onClose()
  }

  async function handleDelete() {
    if (!absence) return
    setDeleting(true)
    setError(null)

    const result = await deleteAbsence(absence.id)
    setDeleting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    onDeleted()
    onClose()
  }

  const absenceName = absence ? getAbsenceName(absence) : null
  const absenceColor = absence ? getAbsenceColor(absence) : null
  const absenceAbbreviation = absence ? getAbsenceAbbreviation(absence) : null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {absence ? 'Abwesenheit' : 'Abwesenheit eintragen'}
          </DialogTitle>
          <p className="text-sm text-slate-500 capitalize">{formatDate(date)}</p>
        </DialogHeader>

        {absence ? (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: absenceColor ?? '#94a3b8' }}
                >
                  {absenceAbbreviation}
                </span>
                <span className="font-medium text-slate-900">{absenceName}</span>
              </div>
              {absence.note && (
                <p className="text-sm text-slate-600 pl-8">
                  {absence.note}
                </p>
              )}
              <p className="text-xs text-slate-400 pl-8">
                Eingetragen am{' '}
                {new Date(absence.created_at).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </p>
            </div>

            {!canDelete && (
              <Alert className="border-slate-200 bg-slate-50">
                <AlertDescription className="text-sm text-slate-500">
                  Diese Abwesenheit kann nicht mehr gelöscht werden (Bearbeitungsfrist abgelaufen).
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert className="border-red-300 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Schließen
              </Button>
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Wird gelöscht…' : 'Abwesenheit löschen'}
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {absenceTypes.length === 0 ? (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertDescription className="text-amber-800 text-sm">
                  Für deinen Bereich sind keine Abwesenheitstypen konfiguriert. Bitte wende dich an deinen Manager.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="absence-type">Abwesenheitstyp *</Label>
                  <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                    <SelectTrigger id="absence-type" className="w-full">
                      <SelectValue placeholder="Typ wählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {absenceTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: t.color ?? '#94a3b8' }}
                            >
                              {t.abbreviation ?? '?'}
                            </span>
                            {t.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="absence-note">
                    Notiz{' '}
                    <span className="text-slate-400 font-normal text-xs">(optional, max. 100 Zeichen)</span>
                  </Label>
                  <Textarea
                    id="absence-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 100))}
                    placeholder="z. B. Arzttermin am Nachmittag"
                    className="resize-none h-20"
                    maxLength={100}
                  />
                  <p className="text-xs text-slate-400 text-right">{note.length}/100</p>
                </div>
              </>
            )}

            {error && (
              <Alert className="border-red-300 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
              {absenceTypes.length > 0 && (
                <Button onClick={handleCreate} disabled={saving || !selectedTypeId}>
                  {saving ? 'Wird gespeichert…' : 'Abwesenheit eintragen'}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
