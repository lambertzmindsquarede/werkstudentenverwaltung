'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BereichConfig } from './absence-type-override-actions'
import {
  loadBereichConfig,
  initOverridesAndToggleGlobal,
  addCustomAbsenceType,
  deleteCustomAbsenceType,
  resetBereichToGlobal,
} from './absence-type-override-actions'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8',
]

interface Props {
  bereiche: { id: string; name: string }[]
  initialBereichId: string | null
  initialConfig: BereichConfig | null
}

export default function AbwesenheitstypenKonfiguration({
  bereiche,
  initialBereichId,
  initialConfig,
}: Props) {
  const [selectedBereichId, setSelectedBereichId] = useState(initialBereichId)
  const [config, setConfig] = useState<BereichConfig | null>(initialConfig)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#3b82f6')
  const [formAbbr, setFormAbbr] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function selectBereich(bereichId: string) {
    setSelectedBereichId(bereichId)
    setError(null)
    setSuccess(null)
    const result = await loadBereichConfig(bereichId)
    if (result.error) setError(result.error)
    else setConfig(result.data ?? null)
  }

  async function handleToggleGlobal(globalTypeId: string, currentActive: boolean) {
    if (!selectedBereichId) return
    setError(null)
    const result = await initOverridesAndToggleGlobal(
      selectedBereichId,
      globalTypeId,
      !currentActive
    )
    if (result.error) {
      setError(result.error)
      return
    }
    // Reload config
    const refreshed = await loadBereichConfig(selectedBereichId)
    if (refreshed.data) setConfig(refreshed.data)
    setSuccess('Konfiguration gespeichert.')
  }

  async function handleAddNewGlobalType(globalTypeId: string) {
    if (!selectedBereichId) return
    setError(null)
    const result = await initOverridesAndToggleGlobal(selectedBereichId, globalTypeId, true)
    if (result.error) {
      setError(result.error)
      return
    }
    const refreshed = await loadBereichConfig(selectedBereichId)
    if (refreshed.data) setConfig(refreshed.data)
    setSuccess('Neuer globaler Typ übernommen.')
  }

  async function handleAddCustom() {
    if (!selectedBereichId) return
    setFormSaving(true)
    setError(null)
    const result = await addCustomAbsenceType(selectedBereichId, {
      name: formName,
      color: formColor || null,
      abbreviation: formAbbr || null,
    })
    setFormSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setShowAddDialog(false)
    const refreshed = await loadBereichConfig(selectedBereichId)
    if (refreshed.data) setConfig(refreshed.data)
    setSuccess('Eigener Typ hinzugefügt.')
  }

  async function handleDeleteCustom(overrideId: string) {
    if (!selectedBereichId) return
    setError(null)
    const result = await deleteCustomAbsenceType(selectedBereichId, overrideId)
    if (result.error) {
      setError(result.error)
      return
    }
    const refreshed = await loadBereichConfig(selectedBereichId)
    if (refreshed.data) setConfig(refreshed.data)
    setSuccess('Eigener Typ entfernt.')
  }

  async function handleReset() {
    if (!selectedBereichId) return
    setError(null)
    startTransition(async () => {
      const result = await resetBereichToGlobal(selectedBereichId)
      if (result.error) {
        setError(result.error)
        setShowResetDialog(false)
        return
      }
      const refreshed = await loadBereichConfig(selectedBereichId)
      if (refreshed.data) setConfig(refreshed.data)
      setSuccess('Auf globale Standardliste zurückgesetzt.')
      setShowResetDialog(false)
    })
  }

  if (bereiche.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm mt-8">
        <CardHeader>
          <CardTitle>Abwesenheitstypen</CardTitle>
          <CardDescription>Bereichsspezifische Konfiguration der Abwesenheitstypen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            Du bist keinem Bereich als Manager zugeordnet. Bitte wende dich an einen Admin.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Determine effective active status for display
  function isEffectivelyActive(gt: BereichConfig['global_types'][number]): boolean {
    if (!config?.has_overrides) return gt.global_is_active
    if (gt.override_is_active !== null) return gt.override_is_active
    return false // not in overrides, not active for this bereich
  }

  const newGlobalTypeIds = new Set(config?.new_global_type_ids ?? [])

  return (
    <div className="mt-8">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Abwesenheitstypen</CardTitle>
          <CardDescription>
            Passe die Abwesenheitstypen für deinen Bereich an. Solange keine Anpassung vorgenommen
            wurde, gilt die unternehmensweite Standardliste.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {bereiche.length > 1 && (
            <div className="space-y-1.5">
              <Label>Bereich</Label>
              <Select value={selectedBereichId ?? ''} onValueChange={selectBereich}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Bereich wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {bereiche.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {success && (
            <Alert className="border-green-300 bg-green-50">
              <AlertDescription className="text-green-700 text-sm">{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* Hint banner: new global types not yet adopted */}
          {config && newGlobalTypeIds.size > 0 && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertDescription className="text-amber-800 text-sm">
                <strong>Neue globale Typen verfügbar:</strong>{' '}
                {config.global_types
                  .filter((gt) => newGlobalTypeIds.has(gt.global_id))
                  .map((gt) => gt.name)
                  .join(', ')}
                . Möchtest du sie für deinen Bereich übernehmen?{' '}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-amber-800 underline"
                  onClick={() => {
                    config.global_types
                      .filter((gt) => newGlobalTypeIds.has(gt.global_id))
                      .forEach((gt) => handleAddNewGlobalType(gt.global_id))
                  }}
                >
                  Alle übernehmen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {config && !config.has_overrides && (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
              Dieser Bereich erbt die unternehmensweite Standardliste. Die erste Anpassung (Toggle
              oder eigener Typ) aktiviert die bereichsspezifische Konfiguration.
            </p>
          )}

          {config && (
            <div className="rounded-lg border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Globale Typen
              </div>
              {config.global_types.map((gt) => {
                const active = isEffectivelyActive(gt)
                const isNew = newGlobalTypeIds.has(gt.global_id)
                return (
                  <div
                    key={gt.global_id}
                    className={`flex items-center justify-between px-4 py-3 ${!active ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: gt.color ?? '#94a3b8' }}
                      >
                        {gt.abbreviation ?? '?'}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{gt.name}</span>
                      {isNew && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          neu
                        </Badge>
                      )}
                      {!gt.global_is_active && (
                        <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">
                          global deaktiviert
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={active}
                      onCheckedChange={() => handleToggleGlobal(gt.global_id, active)}
                      disabled={!gt.global_is_active}
                      aria-label={active ? 'Deaktivieren' : 'Aktivieren'}
                    />
                  </div>
                )
              })}

              {config.custom_types.length > 0 && (
                <>
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Eigene Typen
                  </div>
                  {config.custom_types.map((ct) => (
                    <div key={ct.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: ct.color ?? '#94a3b8' }}
                        >
                          {ct.abbreviation ?? '?'}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{ct.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-red-500 hover:text-red-700 h-7 px-2"
                        onClick={() => handleDeleteCustom(ct.id)}
                      >
                        Entfernen
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {selectedBereichId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormName('')
                  setFormColor('#3b82f6')
                  setFormAbbr('')
                  setError(null)
                  setShowAddDialog(true)
                }}
              >
                + Eigenen Typ hinzufügen
              </Button>
            )}
            {config?.has_overrides && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-red-600"
                onClick={() => setShowResetDialog(true)}
              >
                Auf Standard zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add custom type dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) setShowAddDialog(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eigenen Abwesenheitstyp hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="custom-name">Name *</Label>
              <Input
                id="custom-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value.slice(0, 50))}
                placeholder="z. B. Fortbildung"
                maxLength={50}
              />
              <p className="text-xs text-slate-400 text-right">{formName.length}/50</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-abbr">
                Kürzel{' '}
                <span className="text-slate-400 font-normal text-xs">(1–2 Zeichen, optional)</span>
              </Label>
              <Input
                id="custom-abbr"
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
          {error && (
            <Alert className="border-red-300 bg-red-50 mt-2">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddCustom} disabled={formSaving || !formName.trim()}>
              {formSaving ? 'Speichern…' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation dialog */}
      <Dialog open={showResetDialog} onOpenChange={(open) => { if (!open) setShowResetDialog(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Auf Standard zurücksetzen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Alle bereichsspezifischen Anpassungen werden gelöscht. Der Bereich erbt dann wieder die
            unternehmensweite Standardliste. Bestehende Abwesenheitseinträge bleiben erhalten.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={isPending}
            >
              {isPending ? 'Zurücksetzen…' : 'Zurücksetzen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
