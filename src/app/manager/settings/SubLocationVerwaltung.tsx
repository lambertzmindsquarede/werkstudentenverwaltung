'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { Arbeitsort, SubLocation } from './sublocation-actions'
import {
  getSubLocations,
  createSubLocation,
  updateSubLocation,
  toggleSubLocation,
} from './sublocation-actions'

interface Props {
  arbeitsorte: Arbeitsort[]
  initialSubLocations: Record<string, SubLocation[]>
}

export default function SubLocationVerwaltung({ arbeitsorte, initialSubLocations }: Props) {
  const [subLocationsByArbeitsort, setSubLocationsByArbeitsort] = useState<Record<string, SubLocation[]>>(initialSubLocations)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Add dialog state
  const [addDialog, setAddDialog] = useState<{ open: boolean; arbeitsortId: string | null }>({
    open: false,
    arbeitsortId: null,
  })
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  })
  const [editError, setEditError] = useState<string | null>(null)

  async function loadSubLocations(arbeitsortId: string) {
    const res = await getSubLocations(arbeitsortId)
    if (res.data) {
      setSubLocationsByArbeitsort((prev) => ({ ...prev, [arbeitsortId]: res.data! }))
    }
  }

  function openAddDialog(arbeitsortId: string) {
    setAddName('')
    setAddError(null)
    setAddDialog({ open: true, arbeitsortId })
  }

  function handleAddSubmit() {
    if (!addDialog.arbeitsortId) return
    const arbeitsortId = addDialog.arbeitsortId
    setAddError(null)
    startTransition(async () => {
      const result = await createSubLocation(arbeitsortId, addName)
      if (result.error) {
        setAddError(result.error)
      } else {
        setAddDialog({ open: false, arbeitsortId: null })
        setAddName('')
        await loadSubLocations(arbeitsortId)
      }
    })
  }

  function openEditDialog(id: string, name: string) {
    setEditError(null)
    setEditDialog({ open: true, id, name })
  }

  function handleEditSubmit() {
    if (!editDialog.id) return
    const id = editDialog.id
    setEditError(null)
    startTransition(async () => {
      const result = await updateSubLocation(id, editDialog.name)
      if (result.error) {
        setEditError(result.error)
      } else {
        setEditDialog({ open: false, id: null, name: '' })
        // Reload all to be safe
        for (const a of arbeitsorte) {
          await loadSubLocations(a.id)
        }
      }
    })
  }

  function handleToggle(sl: SubLocation, arbeitsortId: string) {
    startTransition(async () => {
      const result = await toggleSubLocation(sl.id, !sl.is_active)
      if (result.error) {
        setError(result.error)
      } else {
        await loadSubLocations(arbeitsortId)
      }
    })
  }

  if (arbeitsorte.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm mt-6">
        <CardHeader>
          <CardTitle>Arbeitsplätze</CardTitle>
          <CardDescription>
            Noch keine aktiven Arbeitsorte angelegt. Erstelle zuerst Arbeitsorte unter{' '}
            <a href="/manager/arbeitsorte" className="text-blue-600 hover:underline">
              Arbeitsorte
            </a>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-slate-200 shadow-sm mt-6">
        <CardHeader>
          <CardTitle>Arbeitsplätze konfigurieren</CardTitle>
          <CardDescription>
            Lege für jeden Arbeitsort genauere Aufenthaltsorte fest (z.B. „WRK", „LAB", „Platz 3").
            Werkstudenten können ihren Arbeitsplatz in der Team-Ansicht selbst setzen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="border-red-300 bg-red-50 mb-4">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <Accordion type="multiple" className="space-y-2">
            {arbeitsorte.map((arbeitsort) => {
              const sls = subLocationsByArbeitsort[arbeitsort.id] ?? []
              const activeCount = sls.filter((s) => s.is_active).length

              return (
                <AccordionItem
                  key={arbeitsort.id}
                  value={arbeitsort.id}
                  className="border border-slate-200 rounded-lg px-4"
                >
                  <AccordionTrigger
                    className="hover:no-underline"
                    onClick={() => {
                      if (!subLocationsByArbeitsort[arbeitsort.id]) {
                        loadSubLocations(arbeitsort.id)
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{arbeitsort.name}</span>
                      {activeCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {activeCount !== 1 ? `${activeCount} Arbeitsplätze` : '1 Arbeitsplatz'}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-2">
                      {sls.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">Keine Arbeitsplätze angelegt.</p>
                      ) : (
                        sls.map((sl) => (
                          <div
                            key={sl.id}
                            className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2"
                          >
                            <Badge
                              variant={sl.is_active ? 'outline' : 'secondary'}
                              className={`font-mono text-xs min-w-[60px] justify-center ${
                                !sl.is_active ? 'opacity-50' : ''
                              }`}
                            >
                              {sl.name}
                            </Badge>
                            <span
                              className={`text-sm flex-1 ${
                                sl.is_active ? 'text-slate-700' : 'text-slate-400 line-through'
                              }`}
                            >
                              {sl.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-slate-500 h-7"
                              onClick={() => openEditDialog(sl.id, sl.name)}
                              disabled={isPending}
                            >
                              Umbenennen
                            </Button>
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={sl.is_active}
                                onCheckedChange={() => handleToggle(sl, arbeitsort.id)}
                                disabled={isPending}
                                aria-label={sl.is_active ? 'Deaktivieren' : 'Aktivieren'}
                              />
                              <span className="text-xs text-slate-400 w-16">
                                {sl.is_active ? 'Aktiv' : 'Inaktiv'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => openAddDialog(arbeitsort.id)}
                        disabled={isPending}
                      >
                        + Arbeitsplatz hinzufügen
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog
        open={addDialog.open}
        onOpenChange={(o) => { if (!o) setAddDialog({ open: false, arbeitsortId: null }) }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Arbeitsplatz hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="sub-loc-name">Name (z.B. WRK, LAB, Platz 3)</Label>
            <Input
              id="sub-loc-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="z.B. WRK"
              maxLength={50}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubmit() }}
              disabled={isPending}
            />
            {addError && (
              <Alert className="border-red-300 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">{addError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialog({ open: false, arbeitsortId: null })}
              disabled={isPending}
            >
              Abbrechen
            </Button>
            <Button onClick={handleAddSubmit} disabled={isPending || !addName.trim()}>
              {isPending ? 'Speichern…' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(o) => { if (!o) setEditDialog({ open: false, id: null, name: '' }) }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Arbeitsplatz umbenennen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="edit-sub-loc-name">Neuer Name</Label>
            <Input
              id="edit-sub-loc-name"
              value={editDialog.name}
              onChange={(e) => setEditDialog((prev) => ({ ...prev, name: e.target.value }))}
              maxLength={50}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEditSubmit() }}
              disabled={isPending}
            />
            {editError && (
              <Alert className="border-red-300 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">{editError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, id: null, name: '' })}
              disabled={isPending}
            >
              Abbrechen
            </Button>
            <Button onClick={handleEditSubmit} disabled={isPending || !editDialog.name.trim()}>
              {isPending ? 'Speichern…' : 'Umbenennen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
