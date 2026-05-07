'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { AbsenceType } from '@/lib/database.types'
import {
  createAbsenceType,
  toggleAbsenceTypeActive,
  updateAbsenceType,
} from './actions'

interface Props {
  initialTypes: AbsenceType[]
  usingDefaults: boolean
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8',
]

export default function AbwesenheitstypenClient({ initialTypes, usingDefaults }: Props) {
  const [types, setTypes] = useState<AbsenceType[]>(initialTypes)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [editingType, setEditingType] = useState<AbsenceType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#3b82f6')
  const [formAbbr, setFormAbbr] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  function openNewDialog() {
    setFormName('')
    setFormColor('#3b82f6')
    setFormAbbr('')
    setError(null)
    setShowNewDialog(true)
  }

  function openEditDialog(t: AbsenceType) {
    setFormName(t.name)
    setFormColor(t.color ?? '#94a3b8')
    setFormAbbr(t.abbreviation ?? '')
    setError(null)
    setEditingType(t)
  }

  async function handleCreate() {
    setFormSaving(true)
    setError(null)
    const result = await createAbsenceType({
      name: formName,
      color: formColor || null,
      abbreviation: formAbbr || null,
    })
    setFormSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setShowNewDialog(false)
    setSuccess('Typ erstellt.')
    // Refresh types
    window.location.reload()
  }

  async function handleUpdate() {
    if (!editingType) return
    setFormSaving(true)
    setError(null)
    const result = await updateAbsenceType(editingType.id, {
      name: formName,
      color: formColor || null,
      abbreviation: formAbbr || null,
    })
    setFormSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setTypes((prev) =>
      prev.map((t) =>
        t.id === editingType.id
          ? { ...t, name: formName, color: formColor || null, abbreviation: formAbbr || null }
          : t
      )
    )
    setEditingType(null)
    setSuccess('Typ aktualisiert.')
  }

  async function handleToggle(id: string, current: boolean) {
    const result = await toggleAbsenceTypeActive(id, !current)
    if (result.error) {
      setSuccess(null)
      setError(result.error)
      return
    }
    setTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active: !current } : t))
    )
    setError(null)
  }

  const TypeForm = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="type-name">Name *</Label>
        <Input
          id="type-name"
          value={formName}
          onChange={(e) => setFormName(e.target.value.slice(0, 50))}
          placeholder="z. B. Fortbildung"
          maxLength={50}
        />
        <p className="text-xs text-slate-400 text-right">{formName.length}/50</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type-abbr">
          Kürzel{' '}
          <span className="text-slate-400 font-normal text-xs">(1–2 Zeichen, optional)</span>
        </Label>
        <Input
          id="type-abbr"
          value={formAbbr}
          onChange={(e) => setFormAbbr(e.target.value.slice(0, 2).toUpperCase())}
          placeholder="z. B. F"
          maxLength={2}
          className="max-w-[80px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Farbe</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFormColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                formColor === c ? 'border-slate-900 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={formColor}
            onChange={(e) => setFormColor(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border border-slate-200"
            title="Eigene Farbe"
          />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold"
            style={{ backgroundColor: formColor }}
          >
            {formAbbr || '?'}
          </span>
          <span className="text-sm text-slate-600">{formName || 'Vorschau'}</span>
        </div>
      </div>
    </div>
  )

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Abwesenheitstypen</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Unternehmensweite Standard-Liste der Abwesenheitstypen
          </p>
        </div>
        {!usingDefaults && (
          <Button onClick={openNewDialog} size="sm">
            + Neuer Typ
          </Button>
        )}
      </div>

      {usingDefaults && (
        <Alert className="mb-5 border-amber-300 bg-amber-50">
          <AlertDescription className="text-amber-800 text-sm">
            Die Datenbanktabelle <code>absence_types</code> wurde noch nicht eingerichtet. Bitte
            führe zuerst <strong>/backend</strong> aus, um die Tabellen anzulegen. Unten siehst du
            die Standard-Typen, die nach dem Setup automatisch angelegt werden.
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-300 bg-green-50">
          <AlertDescription className="text-green-700 text-sm">{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="mb-4 border-red-300 bg-red-50">
          <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Typen-Liste</CardTitle>
          <CardDescription className="text-xs">
            Deaktivierte Typen sind in allen Bereichen ohne eigene Konfiguration nicht mehr auswählbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {types.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                Noch keine Typen angelegt.
              </div>
            ) : (
              types.map((t) => (
                <div key={t.id} className={`flex items-center justify-between px-6 py-4 ${!t.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: t.color ?? '#94a3b8' }}
                    >
                      {t.abbreviation ?? '?'}
                    </span>
                    <div>
                      <span className="font-medium text-slate-900 text-sm">{t.name}</span>
                      {!t.is_active && (
                        <Badge variant="outline" className="ml-2 text-xs text-slate-400 border-slate-300">
                          deaktiviert
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!usingDefaults && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-slate-500 h-7 px-2"
                          onClick={() => openEditDialog(t)}
                        >
                          Bearbeiten
                        </Button>
                        <Switch
                          checked={t.is_active}
                          onCheckedChange={() => handleToggle(t.id, t.is_active)}
                          aria-label={t.is_active ? 'Deaktivieren' : 'Aktivieren'}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* New type dialog */}
      <Dialog open={showNewDialog} onOpenChange={(open) => { if (!open) setShowNewDialog(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Abwesenheitstyp</DialogTitle>
          </DialogHeader>
          {TypeForm}
          {error && (
            <Alert className="border-red-300 bg-red-50 mt-2">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={formSaving || !formName.trim()}>
              {formSaving ? 'Speichern…' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit type dialog */}
      <Dialog open={!!editingType} onOpenChange={(open) => { if (!open) setEditingType(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Typ bearbeiten</DialogTitle>
          </DialogHeader>
          {TypeForm}
          {error && (
            <Alert className="border-red-300 bg-red-50 mt-2">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditingType(null)}>Abbrechen</Button>
            <Button onClick={handleUpdate} disabled={formSaving || !formName.trim()}>
              {formSaving ? 'Speichern…' : 'Aktualisieren'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
