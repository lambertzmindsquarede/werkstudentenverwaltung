'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createBereich, renameBereich, deleteBereich } from './actions'
import type { BereichWithCounts } from '@/lib/database.types'
import { ManagerSignOutButton } from '@/components/ManagerSignOutButton'

interface Props {
  initialBereiche: BereichWithCounts[]
}

function CreateBereichDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setName('')
    setError(null)
    onClose()
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createBereich(name)
      if (result.error) {
        setError(result.error)
      } else {
        toast.success(`Bereich „${name}" erstellt`)
        handleClose()
        onCreated()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Bereich erstellen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bereich-name">Bereichsname</Label>
            <Input
              id="bereich-name"
              placeholder="z. B. Entwicklung"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isPending && handleCreate()}
              maxLength={100}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending ? 'Erstellen…' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenameBereichDialog({
  bereich,
  onClose,
  onRenamed,
}: {
  bereich: BereichWithCounts | null
  onClose: () => void
  onRenamed: () => void
}) {
  const [name, setName] = useState(bereich?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setError(null)
    onClose()
  }

  function handleRename() {
    if (!bereich) return
    setError(null)
    startTransition(async () => {
      const result = await renameBereich(bereich.id, name)
      if (result.error) {
        setError(result.error)
      } else {
        toast.success(`Bereich umbenannt zu „${name}"`)
        handleClose()
        onRenamed()
      }
    })
  }

  return (
    <Dialog open={!!bereich} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bereich umbenennen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rename-name">Neuer Name</Label>
            <Input
              id="rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isPending && handleRename()}
              maxLength={100}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Abbrechen
          </Button>
          <Button
            onClick={handleRename}
            disabled={isPending || !name.trim() || name === bereich?.name}
          >
            {isPending ? 'Speichern…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteBereichDialog({
  bereich,
  onClose,
  onDeleted,
}: {
  bereich: BereichWithCounts | null
  onClose: () => void
  onDeleted: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!bereich) return
    startTransition(async () => {
      const result = await deleteBereich(bereich.id)
      if (result.error) {
        toast.error(result.error)
        onClose()
      } else {
        toast.success(`Bereich „${bereich.name}" gelöscht`)
        onClose()
        onDeleted()
      }
    })
  }

  return (
    <AlertDialog open={!!bereich} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bereich löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Der Bereich <span className="font-semibold">„{bereich?.name}"</span> wird dauerhaft
            gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            {(bereich?.werkstudentCount ?? 0) > 0 && (
              <span className="block mt-2 text-red-600 font-medium">
                Achtung: Diesem Bereich sind noch {bereich?.werkstudentCount} Werkstudent
                {bereich?.werkstudentCount !== 1 ? 'en' : ''} zugeordnet. Bitte zuerst alle
                Werkstudenten in einen anderen Bereich verschieben.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending || (bereich?.werkstudentCount ?? 0) > 0}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isPending ? 'Löschen…' : 'Löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function BereicheClient({ initialBereiche }: Props) {
  const [bereiche, setBereiche] = useState(initialBereiche)
  const [showCreate, setShowCreate] = useState(false)
  const [renaming, setRenaming] = useState<BereichWithCounts | null>(null)
  const [deleting, setDeleting] = useState<BereichWithCounts | null>(null)

  async function refresh() {
    const res = await fetch('/admin/bereiche?_refresh=1', { cache: 'no-store' })
    if (!res.ok) return
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2.5 py-1 rounded-full">
            Admin
          </span>
          <ManagerSignOutButton />
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          <Link
            href="/admin"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Übersicht
          </Link>
          <Link
            href="/admin/bereiche"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-purple-600"
          >
            Bereiche
          </Link>
          <Link
            href="/admin/abwesenheitstypen"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Abwesenheitstypen
          </Link>
          <Link
            href="/manager/users"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Nutzerverwaltung
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bereiche</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {bereiche.length === 0
                ? 'Noch keine Bereiche erstellt'
                : `${bereiche.length} Bereich${bereiche.length !== 1 ? 'e' : ''}`}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>+ Bereich erstellen</Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Name
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Manager
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Werkstudenten
                </TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bereiche.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-slate-400 text-sm"
                  >
                    Keine Bereiche vorhanden. Erstelle deinen ersten Bereich.
                  </TableCell>
                </TableRow>
              ) : (
                bereiche.map((b) => (
                  <TableRow key={b.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <Link
                        href={`/admin/bereiche/${b.id}`}
                        className="font-medium text-slate-900 hover:text-purple-600 transition-colors"
                      >
                        {b.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                      >
                        {b.managerCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-slate-100 text-slate-600 border-slate-200 text-xs"
                      >
                        {b.werkstudentCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setRenaming(b)}
                        >
                          Umbenennen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setDeleting(b)}
                        >
                          Löschen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <CreateBereichDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refresh}
      />

      <RenameBereichDialog
        bereich={renaming}
        onClose={() => setRenaming(null)}
        onRenamed={refresh}
      />

      <DeleteBereichDialog
        bereich={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={refresh}
      />
    </div>
  )
}
