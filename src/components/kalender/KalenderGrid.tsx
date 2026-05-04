'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { createClient } from '@/lib/supabase-browser'
import {
  getWeekDates,
  dateToString,
  getPreviousWeek,
  getNextWeek,
  getCalendarWeekNumber,
  getWeekDateRange,
} from '@/lib/week-utils'
import KalenderZelle from './KalenderZelle'
import ZellDetailDialog, { type SelectedCell } from './ZellDetailDialog'
import type { Profile, PlannedEntry, ActualEntry } from '@/lib/database.types'
import { fetchHolidaysForDates } from '@/hooks/usePublicHolidays'
import { DEFAULT_BUNDESLAND } from '@/lib/bundesland-utils'

interface Props {
  profiles: Profile[]
  planned: PlannedEntry[]
  actual: ActualEntry[]
  weekStr: string
  today: string
}

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function KalenderGrid({
  profiles,
  planned,
  actual,
  weekStr,
  today,
}: Props) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set())
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  // holidayMaps: bundesland → (date → holidayName)
  const [holidayMaps, setHolidayMaps] = useState<Map<string, Map<string, string>>>(new Map())

  const weekDates = getWeekDates(weekStr)
  const weekDayStrings = weekDates.map(dateToString)

  useEffect(() => {
    const uniqueBundeslaender = [...new Set(profiles.map((p) => (p.bundesland ?? DEFAULT_BUNDESLAND).toUpperCase()))]
    Promise.all(
      uniqueBundeslaender.map(async (bl) => {
        const map = await fetchHolidaysForDates(bl, weekDayStrings)
        return [bl, map] as const
      })
    ).then((entries) => {
      setHolidayMaps(new Map(entries))
    })
  }, [profiles, weekDayStrings.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  function getHolidayName(bundesland: string, date: string): string | null {
    const bl = (bundesland ?? DEFAULT_BUNDESLAND).toUpperCase()
    return holidayMaps.get(bl)?.get(date) ?? null
  }
  const kwNumber = getCalendarWeekNumber(weekStr)
  const dateRange = getWeekDateRange(weekStr)

  // Build lookup maps: userId → date → entries[]
  const planMap = new Map<string, Map<string, PlannedEntry[]>>()
  for (const p of planned) {
    if (!planMap.has(p.user_id)) planMap.set(p.user_id, new Map())
    const dateMap = planMap.get(p.user_id)!
    if (!dateMap.has(p.date)) dateMap.set(p.date, [])
    dateMap.get(p.date)!.push(p)
  }

  const actualMap = new Map<string, Map<string, ActualEntry[]>>()
  for (const a of actual) {
    if (!actualMap.has(a.user_id)) actualMap.set(a.user_id, new Map())
    const dateMap = actualMap.get(a.user_id)!
    if (!dateMap.has(a.date)) dateMap.set(a.date, [])
    dateMap.get(a.date)!.push(a)
  }

  const visibleProfiles = profiles.filter((p) => !hiddenUsers.has(p.id))

  function toggleUser(userId: string) {
    setHiddenUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function navigateWeek(direction: 'prev' | 'next') {
    const target = direction === 'prev' ? getPreviousWeek(weekStr) : getNextWeek(weekStr)
    router.push(`/manager/kalender?week=${target}`)
  }

  function handleCellClick(profile: Profile, date: string) {
    setSelectedCell({
      userName: profile.full_name ?? profile.email ?? '—',
      date,
      plans: planMap.get(profile.id)?.get(date) ?? [],
      actuals: actualMap.get(profile.id)?.get(date) ?? [],
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
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

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-6xl mx-auto flex gap-1">
          <a
            href="/manager"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Übersicht
          </a>
          <a
            href="/manager/users"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Nutzerverwaltung
          </a>
          <a
            href="/manager/kalender"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600"
          >
            Kalenderansicht
          </a>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Kalenderansicht</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Anwesenheitsplanung und Ist-Zeiten aller aktiven Werkstudenten
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Week navigator */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => navigateWeek('prev')}
                aria-label="Vorherige Woche"
              >
                ←
              </Button>
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                KW {kwNumber} · {dateRange}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => navigateWeek('next')}
                aria-label="Nächste Woche"
              >
                →
              </Button>
            </div>

            {/* User filter */}
            {profiles.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <span>Filtern</span>
                    {hiddenUsers.size > 0 && (
                      <Badge className="h-4 px-1.5 text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                        {hiddenUsers.size} ausgeblendet
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Werkstudenten
                  </p>
                  <div className="space-y-2">
                    {profiles.map((profile) => (
                      <div key={profile.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`filter-${profile.id}`}
                          checked={!hiddenUsers.has(profile.id)}
                          onCheckedChange={() => toggleUser(profile.id)}
                        />
                        <Label
                          htmlFor={`filter-${profile.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {profile.full_name ?? profile.email ?? '—'}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {hiddenUsers.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 text-xs text-slate-500"
                      onClick={() => setHiddenUsers(new Set())}
                    >
                      Alle einblenden
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mb-4 flex flex-wrap gap-3">
          {[
            { color: 'bg-slate-100 border border-slate-200', label: 'Nur Plan' },
            { color: 'bg-green-50 border border-green-200', label: 'Anwesend' },
            { color: 'bg-red-50 border border-red-200', label: 'Fehlt' },
            { color: 'bg-orange-50 border border-orange-200', label: 'Ungeplant' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`h-3 w-3 rounded-sm ${color}`} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <ScrollArea className="w-full">
            <div className="min-w-[640px]">
              {/* Column headers */}
              <div
                className="grid border-b border-slate-200 bg-slate-50"
                style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}
              >
                <div className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Werkstudent
                </div>
                {weekDates.map((date, i) => {
                  const dateStr = weekDayStrings[i]
                  const isToday = dateStr === today
                  return (
                    <div
                      key={dateStr}
                      className={`px-2 py-3 text-center ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <div
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          isToday ? 'text-blue-600' : 'text-slate-500'
                        }`}
                      >
                        {DAY_LABELS[i]}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${
                          isToday ? 'text-blue-500 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {date.toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          timeZone: 'UTC',
                        })}
                      </div>
                      {isToday && (
                        <div className="mt-1 h-1 w-1 rounded-full bg-blue-500 mx-auto" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rows */}
              {visibleProfiles.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">
                  {profiles.length === 0
                    ? 'Keine aktiven Werkstudenten vorhanden.'
                    : 'Alle Werkstudenten sind ausgeblendet.'}
                </div>
              ) : (
                visibleProfiles.map((profile, rowIdx) => (
                  <div
                    key={profile.id}
                    className={`grid border-b border-slate-100 last:border-0 hover:bg-slate-50/30 transition-colors`}
                    style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}
                  >
                    {/* Name column */}
                    <div className="px-4 py-3 flex items-center gap-2.5">
                      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center">
                        {getInitials(profile.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {profile.full_name ?? '—'}
                        </p>
                        {profile.weekly_hour_limit && (
                          <p className="text-xs text-slate-400">{profile.weekly_hour_limit}h/Woche</p>
                        )}
                      </div>
                    </div>

                    {/* Day cells */}
                    {weekDayStrings.map((dateStr) => {
                      const isToday = dateStr === today
                      const plans = planMap.get(profile.id)?.get(dateStr) ?? []
                      const acts = actualMap.get(profile.id)?.get(dateStr) ?? []
                      const hName = getHolidayName(profile.bundesland ?? DEFAULT_BUNDESLAND, dateStr)
                      return (
                        <div
                          key={dateStr}
                          className={`p-1.5 ${isToday ? 'bg-blue-50/30' : ''}`}
                        >
                          <KalenderZelle
                            plans={plans}
                            actuals={acts}
                            date={dateStr}
                            today={today}
                            holidayName={hName}
                            onClick={() => handleCellClick(profile, dateStr)}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </main>

      <ZellDetailDialog cell={selectedCell} onClose={() => setSelectedCell(null)} />
    </div>
  )
}
