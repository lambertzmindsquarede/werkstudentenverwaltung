'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { AbwesenheitRow } from './actions'
import { loadManagerAbsences, deleteAbsenceAsManager } from './actions'
import type { ResolvedAbsenceType } from '@/lib/database.types'
import { getAbsenceName, getAbsenceColor, getAbsenceAbbreviation } from '@/lib/database.types'

interface Props {
  initialAbsences: AbwesenheitRow[]
  werkstudenten: { id: string; full_name: string | null; email: string | null }[]
  absenceTypes: ResolvedAbsenceType[]
  isAdmin: boolean
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

type SortKey = 'date' | 'name'
type SortDir = 'asc' | 'desc'

export default function AbwesenheitenClient({ initialAbsences, werkstudenten, absenceTypes, isAdmin }: Props) {
  const [absences, setAbsences] = useState(initialAbsences)
  const [filterUser, setFilterUser] = useState<string>('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [isPending, startTransition] = useTransition()
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function applyFilter() {
    startTransition(async () => {
      const result = await loadManagerAbsences({
        userId: filterUser === 'all' ? null : filterUser,
        dateFrom: filterFrom || null,
        dateTo: filterTo || null,
      })
      if (!result.error) setAbsences(result.data)
    })
  }

  function resetFilter() {
    setFilterUser('all')
    setFilterFrom('')
    setFilterTo('')
    setFilterType('all')
    startTransition(async () => {
      const result = await loadManagerAbsences({})
      if (!result.error) setAbsences(result.data)
    })
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteError(null)
    const result = await deleteAbsenceAsManager(id)
    setDeletingId(null)
    setConfirmingDeleteId(null)
    if (result.error) {
      setDeleteError(result.error)
      return
    }
    setAbsences((prev) => prev.filter((ab) => ab.id !== id))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = filterType === 'all'
    ? absences
    : absences.filter((ab) => getAbsenceName(ab) === filterType)

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'date') {
      cmp = a.date.localeCompare(b.date)
    } else {
      const nameA = a.user_full_name ?? a.user_email ?? ''
      const nameB = b.user_full_name ?? b.user_email ?? ''
      cmp = nameA.localeCompare(nameB, 'de')
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const navItems = [
    { href: '/manager', label: 'Übersicht' },
    { href: '/manager/users', label: 'Nutzerverwaltung' },
    { href: '/manager/kalender', label: 'Kalenderansicht' },
    { href: '/manager/team', label: 'Team' },
    { href: '/manager/abwesenheiten', label: 'Abwesenheiten', active: true },
    { href: '/manager/arbeitsorte', label: 'Arbeitsorte' },
    { href: '/manager/settings', label: 'Einstellungen' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin-Bereich', adminLink: true }] : []),
  ]

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
            {isAdmin ? 'Admin' : 'Manager'}
          </span>
          <Button onClick={handleSignOut} variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
            Abmelden
          </Button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-6xl mx-auto flex gap-1 flex-wrap">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${'adminLink' in item && item.adminLink
                  ? 'text-purple-600 hover:text-purple-700 border-transparent hover:border-purple-300'
                  : item.active
                    ? 'text-slate-900 border-blue-600'
                    : 'text-slate-500 hover:text-slate-700 border-transparent hover:border-slate-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Abwesenheiten</h1>
          <p className="text-slate-500 mt-1 text-sm">Übersicht aller Abwesenheiten deiner Werkstudenten</p>
        </div>

        {/* Filter card */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Person</Label>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Werkstudenten</SelectItem>
                    {werkstudenten.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.full_name ?? ws.email ?? ws.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Abwesenheitstyp</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Typen</SelectItem>
                    {absenceTypes.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Von</Label>
                <Input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bis</Label>
                <Input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={applyFilter} disabled={isPending} size="sm">
                {isPending ? 'Laden…' : 'Anwenden'}
              </Button>
              <Button onClick={resetFilter} disabled={isPending} variant="outline" size="sm">
                Zurücksetzen
              </Button>
            </div>
          </CardContent>
        </Card>

        {deleteError && (
          <Alert className="mb-4 border-red-300 bg-red-50">
            <AlertDescription className="text-red-700 text-sm">{deleteError}</AlertDescription>
          </Alert>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead
                  className="cursor-pointer select-none hover:text-slate-900"
                  onClick={() => toggleSort('name')}
                >
                  Werkstudent {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-slate-900"
                  onClick={() => toggleSort('date')}
                >
                  Datum {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Notiz</TableHead>
                <TableHead>Erfasst am</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-12 text-sm">
                    Keine Abwesenheiten gefunden.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((ab) => {
                  const name = getAbsenceName(ab)
                  const color = getAbsenceColor(ab)
                  const abbr = getAbsenceAbbreviation(ab)
                  return (
                    <TableRow key={ab.id}>
                      <TableCell className="font-medium text-sm">
                        {ab.user_full_name ?? ab.user_email ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatDate(ab.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="text-white text-xs font-medium gap-1"
                          style={{ backgroundColor: color }}
                        >
                          <span className="font-bold">{abbr}</span>
                          {name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">
                        {ab.note ?? <span className="text-slate-300 italic">–</span>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 tabular-nums">
                        {new Date(ab.created_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {confirmingDeleteId === ab.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-slate-500 mr-1">Löschen?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              disabled={deletingId === ab.id}
                              onClick={() => handleDelete(ab.id)}
                            >
                              {deletingId === ab.id ? '…' : 'Ja'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => setConfirmingDeleteId(null)}
                            >
                              Nein
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => { setConfirmingDeleteId(ab.id); setDeleteError(null) }}
                          >
                            Löschen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {sorted.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-right">
            {sorted.length} Eintrag{sorted.length !== 1 ? 'e' : ''}
          </p>
        )}
      </main>
    </div>
  )
}
