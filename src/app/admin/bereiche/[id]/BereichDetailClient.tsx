'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { addManagerToBereich, removeManagerFromBereich } from '../actions'
import type { Bereich, Profile } from '@/lib/database.types'
import { ManagerSignOutButton } from '@/components/ManagerSignOutButton'

type ManagerEntry = {
  user_id: string
  profiles:
    | {
        id: string
        full_name: string | null
        email: string | null
        role: string | null
        is_admin: boolean
      }
    | null
    | Array<{
        id: string
        full_name: string | null
        email: string | null
        role: string | null
        is_admin: boolean
      }>
}

type AvailableManager = Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'is_admin'>

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function resolveProfile(entry: ManagerEntry) {
  const p = entry.profiles
  if (!p) return null
  if (Array.isArray(p)) return p[0] ?? null
  return p
}

interface AddManagerDialogProps {
  open: boolean
  onClose: () => void
  onAdded: () => void
  bereichId: string
  availableManagers: AvailableManager[]
  assignedUserIds: string[]
}

function AddManagerDialog({
  open,
  onClose,
  onAdded,
  bereichId,
  availableManagers,
  assignedUserIds,
}: AddManagerDialogProps) {
  const [selectedId, setSelectedId] = useState<string>('none')
  const [isPending, startTransition] = useTransition()

  const unassigned = availableManagers.filter((m) => !assignedUserIds.includes(m.id))

  function handleClose() {
    setSelectedId('none')
    onClose()
  }

  function handleAdd() {
    if (selectedId === 'none') return
    startTransition(async () => {
      const result = await addManagerToBereich(bereichId, selectedId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Manager hinzugefügt')
        handleClose()
        onAdded()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manager hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {unassigned.length === 0 ? (
            <p className="text-sm text-slate-500">
              Alle verfügbaren Manager sind bereits diesem Bereich zugeordnet.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="manager-select">Manager auswählen</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="manager-select">
                  <SelectValue placeholder="Manager auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Bitte wählen —</SelectItem>
                  {unassigned.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name ?? m.email ?? m.id}
                      {m.is_admin && (
                        <span className="ml-1 text-purple-600 text-xs">(Admin)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Abbrechen
          </Button>
          {unassigned.length > 0 && (
            <Button onClick={handleAdd} disabled={isPending || selectedId === 'none'}>
              {isPending ? 'Hinzufügen…' : 'Hinzufügen'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Props {
  bereich: Bereich
  managers: ManagerEntry[]
  werkstudenten: Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>[]
  availableManagers: AvailableManager[]
}

export default function BereichDetailClient({
  bereich,
  managers,
  werkstudenten,
  availableManagers,
}: Props) {
  const [showAddManager, setShowAddManager] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isPendingRemove, startRemoveTransition] = useTransition()

  const assignedUserIds = managers.map((m) => m.user_id)

  function handleRemoveManager(userId: string, name: string | null) {
    setRemovingId(userId)
    startRemoveTransition(async () => {
      const result = await removeManagerFromBereich(bereich.id, userId)
      setRemovingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${name ?? 'Manager'} entfernt`)
        window.location.reload()
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/logo-mindsquare-176x781.webp" alt="mindsquare" width={90} height={40} />
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

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/admin/bereiche" className="hover:text-slate-700 transition-colors">
            Bereiche
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">{bereich.name}</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{bereich.name}</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {managers.length} Manager · {werkstudenten.length} Werkstudent
            {werkstudenten.length !== 1 ? 'en' : ''}
          </p>
        </div>

        <Separator />

        {/* Manager Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Manager</h2>
            <Button size="sm" onClick={() => setShowAddManager(true)}>
              + Manager hinzufügen
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Rolle
                  </TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-10 text-slate-400 text-sm"
                    >
                      Noch keine Manager zugeordnet.
                    </TableCell>
                  </TableRow>
                ) : (
                  managers.map((entry) => {
                    const profile = resolveProfile(entry)
                    return (
                      <TableRow key={entry.user_id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                                {getInitials(profile?.full_name ?? null)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {profile?.full_name ?? '—'}
                              </p>
                              <p className="text-xs text-slate-500">{profile?.email ?? '—'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {profile?.role === 'manager' && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                              >
                                Manager
                              </Badge>
                            )}
                            {profile?.is_admin && (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
                              >
                                Admin
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() =>
                              handleRemoveManager(entry.user_id, profile?.full_name ?? null)
                            }
                            disabled={isPendingRemove && removingId === entry.user_id}
                          >
                            {isPendingRemove && removingId === entry.user_id
                              ? 'Entfernen…'
                              : 'Entfernen'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Werkstudenten Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Werkstudenten</h2>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    E-Mail
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {werkstudenten.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center py-10 text-slate-400 text-sm"
                    >
                      Keine Werkstudenten diesem Bereich zugeordnet.
                    </TableCell>
                  </TableRow>
                ) : (
                  werkstudenten.map((ws) => (
                    <TableRow key={ws.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-medium">
                              {getInitials(ws.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-sm font-medium text-slate-900">
                            {ws.full_name ?? '—'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-500">{ws.email ?? '—'}</p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Werkstudenten werden über die Nutzerverwaltung einem Bereich zugeordnet.
          </p>
        </section>
      </main>

      <AddManagerDialog
        open={showAddManager}
        onClose={() => setShowAddManager(false)}
        onAdded={() => window.location.reload()}
        bereichId={bereich.id}
        availableManagers={availableManagers}
        assignedUserIds={assignedUserIds}
      />
    </div>
  )
}
