'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ManagerNav from '@/components/manager/ManagerNav'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
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
import { updateUserProfile, getUsersForManager } from './actions'
import { assignWerkstudentToBereich, getManagerBereichIds, setManagerBereiche } from '@/app/admin/bereiche/actions'
import type { Profile, UserRole, Bereich } from '@/lib/database.types'
import { BUNDESLAENDER, DEFAULT_BUNDESLAND } from '@/lib/bundesland-utils'
import { AlertCircle } from 'lucide-react'
import StundenzettelExportButton from '@/components/zeiterfassung/StundenzettelExportButton'

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
  managers: Profile[]
  bereiche: Bereich[]
  onClose: () => void
  onSaved: () => void
}

function EditUserDialog({ user, managers, bereiche, onClose, onSaved }: EditDialogProps) {
  const [editRole, setEditRole] = useState<UserRole | 'none'>('none')
  const [editHourLimit, setEditHourLimit] = useState<string>('20')
  const [editBundesland, setEditBundesland] = useState<string>(DEFAULT_BUNDESLAND)
  const [editManagerId, setEditManagerId] = useState<string>('none')
  const [editBereichId, setEditBereichId] = useState<string>('none')
  const [managerBereichIds, setManagerBereichIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (user) {
      setEditRole(user.role ?? 'none')
      setEditHourLimit(String(user.weekly_hour_limit ?? 20))
      setEditBundesland(user.bundesland ?? DEFAULT_BUNDESLAND)
      setEditManagerId(user.manager_id ?? 'none')
      setEditBereichId(user.bereich_id ?? 'none')
      if (user.role === 'manager') {
        getManagerBereichIds(user.id).then(setManagerBereichIds)
      } else {
        setManagerBereichIds([])
      }
    }
  }, [user])

  const effectiveRole = editRole === 'none' ? null : editRole

  function handleSave() {
    if (!user) return
    const limit = parseInt(editHourLimit, 10)
    if (isNaN(limit) || limit < 1 || limit > 40) {
      toast.error('Stundenlimit muss zwischen 1 und 40 liegen.')
      return
    }
    startTransition(async () => {
      const result = await updateUserProfile(user.id, {
        role: effectiveRole,
        weekly_hour_limit: limit,
        bundesland: editBundesland,
        manager_id: effectiveRole === 'werkstudent' ? (editManagerId === 'none' ? null : editManagerId) : null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (effectiveRole === 'werkstudent') {
        const bereichResult = await assignWerkstudentToBereich(
          user.id,
          editBereichId === 'none' ? null : editBereichId
        )
        if (bereichResult.error) {
          toast.error(bereichResult.error)
          return
        }
      }
      if (effectiveRole === 'manager') {
        const bereichResult = await setManagerBereiche(user.id, managerBereichIds)
        if (bereichResult.error) {
          toast.error(bereichResult.error)
          return
        }
      }
      toast.success('Gespeichert')
      onSaved()
      onClose()
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

            {effectiveRole === 'manager' && (
              <div className="space-y-2">
                <Label>Bereiche</Label>
                {bereiche.length === 0 ? (
                  <p className="text-xs text-slate-400">Keine Bereiche vorhanden. Zuerst Bereiche in der Admin-Verwaltung anlegen.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-md p-2">
                    {bereiche.map((b) => (
                      <div key={b.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`mgr-bereich-${b.id}`}
                          checked={managerBereichIds.includes(b.id)}
                          onCheckedChange={(checked) => {
                            setManagerBereichIds((prev) =>
                              checked ? [...prev, b.id] : prev.filter((id) => id !== b.id)
                            )
                          }}
                        />
                        <label
                          htmlFor={`mgr-bereich-${b.id}`}
                          className="text-sm text-slate-700 cursor-pointer"
                        >
                          {b.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {effectiveRole === 'werkstudent' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="manager-select">Vorgesetzter</Label>
                  <Select value={editManagerId} onValueChange={setEditManagerId}>
                    <SelectTrigger id="manager-select">
                      <SelectValue placeholder="Vorgesetzten auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Vorgesetzter</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name ?? m.email ?? m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    Erhält E-Mail-Benachrichtigungen bei nachträglichen Buchungsänderungen
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bereich-select">Bereich</Label>
                  <Select value={editBereichId} onValueChange={setEditBereichId}>
                    <SelectTrigger id="bereich-select">
                      <SelectValue placeholder="Bereich auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Bereich</SelectItem>
                      {bereiche.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

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

            <div className="space-y-2">
              <Label htmlFor="bundesland-select">Bundesland</Label>
              <Select value={editBundesland} onValueChange={setEditBundesland}>
                <SelectTrigger id="bundesland-select">
                  <SelectValue placeholder="Bundesland auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BUNDESLAENDER).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">Wird für bundesland-spezifische Feiertage verwendet</p>
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

interface UsersClientProps {
  initialUsers: Profile[]
  managers: Profile[]
  isAdmin: boolean
  bereiche: Bereich[]
  selectedBereich: string | null
}

export default function UsersClient({
  initialUsers,
  managers,
  isAdmin,
  bereiche,
  selectedBereich,
}: UsersClientProps) {
  const router = useRouter()
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [refreshing, setRefreshing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterRole, setFilterRole] = useState<FilterRole>('all')
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Sync users state when SSR data changes (after router.refresh())
  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  async function refreshUsers() {
    setRefreshing(true)
    const result = await getUsersForManager(selectedBereich)
    if (!('error' in result)) {
      setUsers(result.users)
    }
    setRefreshing(false)
  }

  async function handleToggleActive(user: Profile) {
    setTogglingId(user.id)
    const result = await updateUserProfile(user.id, { is_active: !user.is_active })
    setTogglingId(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(user.is_active ? 'Nutzer deaktiviert' : 'Nutzer aktiviert')
      await refreshUsers()
    }
  }

  function handleBereichFilterChange(value: string) {
    const params = new URLSearchParams()
    if (value !== 'all') params.set('bereich', value)
    const query = params.toString()
    router.push(`/manager/users${query ? `?${query}` : ''}`)
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
      <ManagerNav isAdmin={isAdmin} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nutzerverwaltung</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {`${activeCount} aktive Nutzer`}
              {pendingCount > 0 && (
                <span className="ml-2 text-yellow-600 font-medium">
                  · {pendingCount} ausstehend
                </span>
              )}
            </p>
          </div>

          {/* Admin-only: bereich filter */}
          {isAdmin && bereiche.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Bereich:</span>
              <Select
                value={selectedBereich ?? 'all'}
                onValueChange={handleBereichFilterChange}
              >
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Bereiche</SelectItem>
                  {bereiche.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

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
                  Vorgesetzter
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Stunden/Woche
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Aktiv
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Pers.-Nr.
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {refreshing ? (
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
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-9" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                    {users.length === 0 && !isAdmin
                      ? 'Ihrem Bereich sind noch keine Werkstudenten zugeordnet.'
                      : 'Keine Nutzer gefunden.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const assignedManager = user.manager_id
                    ? managers.find((u) => u.id === user.manager_id)
                    : null
                  return (
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
                        {user.role === 'werkstudent' ? (
                          <span className="text-sm text-slate-700">
                            {assignedManager?.full_name ?? <span className="text-slate-400">—</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
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
                        {user.role === 'werkstudent' ? (
                          user.personalnummer ? (
                            <span className="text-sm text-slate-600">{user.personalnummer}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Fehlt
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.role === 'werkstudent' && (
                            <StundenzettelExportButton
                              userId={user.id}
                              disabled={!user.personalnummer}
                              disabledReason="Personalnummer fehlt."
                            />
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setEditingUser(user)}
                          >
                            Bearbeiten
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <EditUserDialog
        user={editingUser}
        managers={managers}
        bereiche={bereiche}
        onClose={() => setEditingUser(null)}
        onSaved={refreshUsers}
      />
    </div>
  )
}
