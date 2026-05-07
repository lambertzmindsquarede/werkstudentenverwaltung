'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase-browser'
import {
  createArbeitsort,
  updateArbeitsort,
  toggleArbeitsort,
} from '@/app/manager/arbeitsorte/actions'
import type { Arbeitsort } from '@/lib/database.types'

interface Props {
  initialArbeitsorte: Arbeitsort[]
  isAdmin?: boolean
}

export default function ArbeitsortVerwaltungClient({ initialArbeitsorte, isAdmin = false }: Props) {
  const [arbeitsorte, setArbeitsorte] = useState<Arbeitsort[]>(initialArbeitsorte)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogName, setDialogName] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function openCreate() {
    setDialogName('')
    setDialogError(null)
    setEditingId(null)
    setShowCreateDialog(true)
  }

  function openEdit(ort: Arbeitsort) {
    setDialogName(ort.name)
    setDialogError(null)
    setEditingId(ort.id)
    setShowCreateDialog(true)
  }

  function closeDialog() {
    setShowCreateDialog(false)
    setEditingId(null)
    setDialogName('')
    setDialogError(null)
  }

  async function handleSave() {
    if (!dialogName.trim()) {
      setDialogError('Name darf nicht leer sein.')
      return
    }
    setSaving(true)
    setDialogError(null)

    let result: { error?: string }
    if (editingId) {
      result = await updateArbeitsort(editingId, dialogName)
    } else {
      result = await createArbeitsort(dialogName)
    }

    setSaving(false)

    if (result.error) {
      setDialogError(result.error)
      return
    }

    if (editingId) {
      setArbeitsorte((prev) =>
        prev.map((a) => (a.id === editingId ? { ...a, name: dialogName.trim() } : a))
      )
      toast.success('Arbeitsort aktualisiert')
    } else {
      // Refresh the list from server by reloading the page
      toast.success('Arbeitsort angelegt')
      window.location.reload()
    }
    closeDialog()
  }

  async function handleToggle(ort: Arbeitsort) {
    setTogglingId(ort.id)
    const result = await toggleArbeitsort(ort.id, !ort.is_active)
    setTogglingId(null)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setArbeitsorte((prev) =>
      prev.map((a) => (a.id === ort.id ? { ...a, is_active: !ort.is_active } : a))
    )
    toast.success(ort.is_active ? 'Arbeitsort deaktiviert' : 'Arbeitsort reaktiviert')
  }

  const activeCount = arbeitsorte.filter((a) => a.is_active).length
  const inactiveCount = arbeitsorte.filter((a) => !a.is_active).length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2.5 py-1 rounded-full">
            Manager
          </span>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700"
          >
            Abmelden
          </Button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-4xl mx-auto flex gap-1">
          <a href="/manager" className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors">
            Übersicht
          </a>
          <a href="/manager/users" className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors">
            Nutzerverwaltung
          </a>
          <a href="/manager/kalender" className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors">
            Kalenderansicht
          </a>
          <a href="/manager/team" className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors">
            Team
          </a>
          <a href="/manager/abwesenheiten" className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors">
            Abwesenheiten
          </a>
          <a href="/manager/arbeitsorte" className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600">
            Arbeitsorte
          </a>
          <a href="/manager/settings" className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors">
            Einstellungen
          </a>
          {isAdmin && (
            <a href="/admin" className="px-4 py-3 text-sm font-medium text-purple-600 hover:text-purple-700 border-b-2 border-transparent hover:border-purple-300 transition-colors">
              Admin-Bereich
            </a>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Arbeitsorte</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Pflege die verfügbaren Arbeitsorte für dein Team ({activeCount} aktiv
              {inactiveCount > 0 && `, ${inactiveCount} inaktiv`})
            </p>
          </div>
          <Button onClick={openCreate}>
            + Neuer Arbeitsort
          </Button>
        </div>

        {arbeitsorte.length === 0 ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-slate-400 text-sm mb-3">Noch keine Arbeitsorte angelegt.</p>
              <Button variant="outline" onClick={openCreate}>
                Ersten Arbeitsort anlegen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-base font-semibold text-slate-700">Alle Arbeitsorte</CardTitle>
              <CardDescription className="text-xs">
                Aktive Orte können von Werkstudenten in der Wochenplanung gewählt werden.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <div className="divide-y divide-slate-100">
                {arbeitsorte.map((ort) => (
                  <div
                    key={ort.id}
                    className={`flex items-center justify-between px-6 py-3.5 ${!ort.is_active ? 'bg-slate-50/60 opacity-75' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${ort.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                        {ort.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={ort.is_active
                          ? 'text-green-700 border-green-200 bg-green-50 text-xs'
                          : 'text-slate-400 border-slate-200 bg-slate-50 text-xs'}
                      >
                        {ort.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {ort.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-slate-500 hover:text-slate-700"
                          onClick={() => openEdit(ort)}
                        >
                          Bearbeiten
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={togglingId === ort.id}
                        className={`h-8 text-xs ${ort.is_active ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`}
                        onClick={() => handleToggle(ort)}
                      >
                        {togglingId === ort.id
                          ? '…'
                          : ort.is_active
                          ? 'Deaktivieren'
                          : 'Reaktivieren'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {inactiveCount > 0 && (
          <Alert className="mt-4 bg-amber-50 border-amber-200">
            <AlertDescription className="text-xs text-amber-800">
              Inaktive Orte sind für neue Planungen gesperrt, bleiben aber in historischen Einträgen sichtbar.
            </AlertDescription>
          </Alert>
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Arbeitsort bearbeiten' : 'Neuer Arbeitsort'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={dialogName}
              onChange={(e) => {
                setDialogName(e.target.value)
                setDialogError(null)
              }}
              placeholder="z.B. Homeoffice, Büro Paderborn, Kunde TKSE"
              maxLength={100}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            {dialogError && (
              <p className="text-xs text-red-500 mt-1.5">{dialogError}</p>
            )}
            <p className="text-xs text-slate-400 mt-1.5">{dialogName.length}/100 Zeichen</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving || !dialogName.trim()}>
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
