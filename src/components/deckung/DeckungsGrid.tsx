'use client'

import { useRouter } from 'next/navigation'
import ManagerNav from '@/components/manager/ManagerNav'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import WochenGantt from './WochenGantt'
import TagesGantt from './TagesGantt'
import {
  getPreviousWeek,
  getNextWeek,
  getWeekDateRange,
  getCalendarWeekNumber,
  getWeekDates,
  dateToString,
} from '@/lib/week-utils'
import type { Profile, PlannedEntry, Bereich } from '@/lib/database.types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const COLORS = [
  { bg: 'bg-blue-500', text: 'text-white' },
  { bg: 'bg-emerald-500', text: 'text-white' },
  { bg: 'bg-amber-500', text: 'text-white' },
  { bg: 'bg-rose-500', text: 'text-white' },
  { bg: 'bg-violet-500', text: 'text-white' },
  { bg: 'bg-pink-500', text: 'text-white' },
  { bg: 'bg-teal-500', text: 'text-white' },
  { bg: 'bg-orange-500', text: 'text-white' },
  { bg: 'bg-indigo-500', text: 'text-white' },
  { bg: 'bg-lime-600', text: 'text-white' },
]

export function getUserColor(userId: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) & 0xffffffff
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

interface Props {
  profiles: Profile[]
  planned: PlannedEntry[]
  weekStr: string
  today: string
  initialView: 'woche' | 'tag'
  initialDay: string
  isAdmin: boolean
  bereiche: Bereich[]
  selectedBereich: string | null
}

export default function DeckungsGrid({
  profiles,
  planned,
  weekStr,
  today,
  initialView,
  initialDay,
  isAdmin,
  bereiche,
  selectedBereich,
}: Props) {
  const router = useRouter()

  function buildParams(overrides: Record<string, string | null>) {
    const params = new URLSearchParams()
    params.set('week', weekStr)
    params.set('view', initialView)
    if (initialView === 'tag') params.set('day', initialDay)
    if (selectedBereich) params.set('bereich', selectedBereich)
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    return params.toString()
  }

  function navigateWeek(newWeek: string) {
    router.push(`/manager/deckung?${buildParams({ week: newWeek })}`)
  }

  function navigateToDay(day: string) {
    router.push(`/manager/deckung?${buildParams({ view: 'tag', day })}`)
  }

  function navigateView(view: string) {
    const overrides: Record<string, string | null> = { view }
    if (view === 'woche') overrides.day = null
    router.push(`/manager/deckung?${buildParams(overrides)}`)
  }

  function navigateBereich(bereichId: string) {
    const overrides: Record<string, string | null> = {
      bereich: bereichId === 'all' ? null : bereichId,
    }
    router.push(`/manager/deckung?${buildParams(overrides)}`)
  }

  const weekDates = getWeekDates(weekStr).map(dateToString)

  return (
    <div className="min-h-screen bg-slate-50">
      <ManagerNav isAdmin={isAdmin} />

      <main className="px-6 py-6 max-w-screen-2xl mx-auto">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Deckungsübersicht</h1>
            <p className="text-slate-500 mt-1 text-sm">Geplante Zeitblöcke aller Werkstudenten auf einen Blick</p>
          </div>

          {isAdmin && bereiche.length > 0 && (
            <Select value={selectedBereich ?? 'all'} onValueChange={navigateBereich}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Alle Bereiche" />
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
          )}
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="outline" size="sm" onClick={() => navigateWeek(getPreviousWeek(weekStr))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center min-w-36">
            <span className="text-sm font-semibold text-slate-900">
              KW {getCalendarWeekNumber(weekStr)}
            </span>
            <span className="text-xs text-slate-500">{getWeekDateRange(weekStr)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigateWeek(getNextWeek(weekStr))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={initialView} onValueChange={navigateView}>
          <TabsList className="mb-4">
            <TabsTrigger value="woche">Wochenansicht</TabsTrigger>
            <TabsTrigger value="tag">Tagesansicht</TabsTrigger>
          </TabsList>

          <TabsContent value="woche">
            <WochenGantt
              profiles={profiles}
              planned={planned}
              weekDates={weekDates}
              today={today}
              onDayClick={navigateToDay}
            />
          </TabsContent>

          <TabsContent value="tag">
            <TagesGantt
              profiles={profiles}
              planned={planned}
              day={initialDay}
              today={today}
              onDayNavigate={(day) => {
                router.push(`/manager/deckung?${buildParams({ view: 'tag', day })}`)
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Legend */}
        {profiles.length > 0 && (
          <div className="mt-5 p-4 bg-white rounded-lg border border-slate-200">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
              Legende
            </h3>
            <div className="flex flex-wrap gap-3">
              {profiles.map((profile) => {
                const color = getUserColor(profile.id)
                return (
                  <div key={profile.id} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${color.bg}`} />
                    <span className="text-sm text-slate-600">
                      {profile.full_name ?? profile.email}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
