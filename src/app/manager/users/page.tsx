'use client'

import Image from 'next/image'
import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase-browser'
import { updateUserProfile } from './actions'
import type { Profile, UserRole } from '@/lib/database.types'

type FilterStatus = 'all' | 'pending' | 'active' | 'inactive'
type FilterRole = 'all' | 'werkstudent' | 'manager'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function StatusBadge({ profile }: { profile: Profile }) {
  if (!profile.role) {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
        Ausstehend
      </Badge>
    )
  }
  if (profile.is_active === false) {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
        Inaktiv
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
      Aktiv
    </Badge>
  )
}

function RoleBadge({ role }: { role: UserRole | null }) {
  if (!role) return <span className="text-slate-400 text-sm">—</span>
  if (role === 'manager') {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        Manager
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
      Werkstudent
    </Badge>
  )
}

interface EditDialogProps {
  user: Profile | null
  onClose: () => void
  onSaved: () => void
}

function EditUserDialog({ user, onClose, onSaved }: EditDialogProps) {
  const [editRole, setEditRole] = useState<UserRole | 'none'>('none')
  const [editHourLimit, setEditHourLimit] = useState<string>('20')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (user) {
      setEditRole(user.role ?? 'none')
      setEditHourLimit(String(user.weekly_hour_limit ?? 20))
    }
  }, [user])

  function handleSave() {
    if (!user) return
    const limit = parseInt(editHourLimit, 10)
    if (isNaN(limit) || limit < 1 || limit > 40) {
      toast.error('Stundenlimit muss zwischen 1 und 40 liegen.')
      return
    }
    startTransition(async () => {
      const result = await updateUserProfile(user.id, {
        role: editRole === 'none' ? null : editRole,
        weekly_hour_limit: limit,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Gespeichert')
        onSaved()
        onClose()
      }
    })
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nutzer bearbeiten</DialogTitle>
        </DialogHeader>
        {user && (
          <div className="space-y-5 py-2">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-slate-900 text-sm">{user.full_name ?? '—'}</p>
                <p className="text-xs text-slate-500">{user.email ?? '—'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-select">Rolle</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as UserRole | 'none')}
              >
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="Rolle auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Rolle (ausstehend)</SelectItem>
                  <SelectItem value="werkstudent">Werkstudent</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hour-limit">Max. Wochenstunden</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="hour-limit"
                  type="number"
                  min={1}
                  max={40}
                  value={editHourLimit}
                  onChange={(e) => setEditHourLimit(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-slate-500">h / Woche</span>
              </div>
              <p className="text-xs text-slate-400">Zulässig: 1–40h (gesetzlich max. 20h)</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Speichern…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterRole, setFilterRole] = useState<FilterRole>('all')
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function fetchUsers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function handleToggleActive(user: Profile) {
    setTogglingId(user.id)
    const result = await updateUserProfile(user.id, { is_active: !user.is_active })
    setTogglingId(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(user.is_active ? 'Nutzer deaktiviert' : 'Nutzer aktiviert')
      await fetchUsers()
    }
  }

  const pendingCount = users.filter((u) => !u.role).length
  const activeCount = users.filter((u) => u.role && u.is_active !== false).length
  const inactiveCount = users.filter((u) => u.role && u.is_active === false).length

  const filteredUsers = users.filter((u) => {
    const statusMatch =
      filterStatus === 'all' ||
      (filterStatus === 'pending' && !u.role) ||
      (filterStatus === 'active' && u.role && u.is_active !== false) ||
      (filterStatus === 'inactive' && u.role && u.is_active === false)

    const roleMatch = filterRole === 'all' || u.role === filterRole

    return statusMatch && roleMatch
  })

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
            disabled={signingOut}
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700"
          >
            {signingOut ? 'Abmelden…' : 'Abmelden'}
          </Button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          <a
            href="/manager"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Übersicht
          </a>
          <a
            href="/manager/users"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600 flex items-center gap-1.5"
          >
            Nutzerverwaltung
            {pendingCount > 0 && (
              <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </a>
          <a
            href="/manager/kalender"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Kalenderansicht
          </a>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nutzerverwaltung</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {loading ? '…' : `${activeCount} aktive Nutzer`}
              {pendingCount > 0 && (
                <span className="ml-2 text-yellow-600 font-medium">
                  · {pendingCount} ausstehend
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <Tabs
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as FilterStatus)}
          >
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">
                Alle ({users.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">
                Ausstehend ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs">
                Aktiv ({activeCount})
              </TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs">
                Inaktiv ({inactiveCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select
            value={filterRole}
            onValueChange={(v) => setFilterRole(v as FilterRole)}
          >
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Rollen</SelectItem>
              <SelectItem value="werkstudent">Werkstudent</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Nutzer
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Rolle
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Stunden/Woche
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Aktiv
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-44" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-9" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    Keine Nutzer gefunden.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {user.full_name ?? '—'}
                          </p>
                          <p className="text-xs text-slate-500">{user.email ?? '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge profile={user} />
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-700">
                        {user.weekly_hour_limit != null ? `${user.weekly_hour_limit}h` : '20h'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.is_active !== false}
                        onCheckedChange={() => handleToggleActive(user)}
                        disabled={!user.role || togglingId === user.id}
                        aria-label={`${user.full_name} aktivieren/deaktivieren`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setEditingUser(user)}
                      >
                        Bearbeiten
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <EditUserDialog
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={fetchUsers}
      />
    </div>
  )
}
