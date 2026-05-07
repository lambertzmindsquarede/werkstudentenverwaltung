'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import GruppenSection from '@/components/team/GruppenSection'
import type { TeamPresenceData, PersonPresence } from '@/app/dashboard/team/actions'
import { getTeamPresenceForBereich } from './actions'

interface Props {
  today: string
  bereiche: { id: string; name: string }[]
  selectedBereichId: string
  initialData: TeamPresenceData
  isAdmin: boolean
}

const NO_OP_SUB_LOCATION = async () => ({})

export default function ManagerTeamClient({
  today,
  bereiche,
  selectedBereichId,
  initialData,
  isAdmin,
}: Props) {
  const router = useRouter()
  const [data, setData] = useState<TeamPresenceData>(initialData)
  const [signingOut, setSigningOut] = useState(false)
  const [, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    const res = await getTeamPresenceForBereich(selectedBereichId, today)
    if (res.data) setData(res.data)
  }, [selectedBereichId, today])

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('manager_team_presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_presence' }, () => {
        startTransition(() => {
          refresh()
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planned_entries' }, () => {
        startTransition(() => {
          refresh()
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  function handleBereichChange(value: string) {
    router.push(`/manager/team?bereich=${value}`)
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const now = new Date()
  const dateLabel = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  const team = data.teams[0]
  const members = team?.members ?? []

  const arbeitsortGroups = new Map<string, PersonPresence[]>()
  const absenceGroups = new Map<string, PersonPresence[]>()
  const noStatus: PersonPresence[] = []

  for (const m of members) {
    if (m.group_type === 'arbeitsort') {
      const arr = arbeitsortGroups.get(m.group_label) ?? []
      arr.push(m)
      arbeitsortGroups.set(m.group_label, arr)
    } else if (m.group_type === 'absence') {
      const arr = absenceGroups.get(m.group_label) ?? []
      arr.push(m)
      absenceGroups.set(m.group_label, arr)
    } else {
      noStatus.push(m)
    }
  }

  const sharedProps = {
    currentUserId: '',
    subLocations: [],
    todayArbeitsortId: null,
    onSetSubLocation: NO_OP_SUB_LOCATION,
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
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}
          >
            {isAdmin ? 'Admin' : 'Manager'}
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
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Nutzerverwaltung
          </a>
          <a
            href="/manager/kalender"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Kalenderansicht
          </a>
          <a
            href="/manager/team"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600"
          >
            Team
          </a>
          <a
            href="/manager/abwesenheiten"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Abwesenheiten
          </a>
          <a
            href="/manager/arbeitsorte"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Arbeitsorte
          </a>
          <a
            href="/manager/settings"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Einstellungen
          </a>
          {isAdmin && (
            <a
              href="/admin"
              className="px-4 py-3 text-sm font-medium text-purple-600 hover:text-purple-700 border-b-2 border-transparent hover:border-purple-300 transition-colors"
            >
              Admin-Bereich
            </a>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team-Anwesenheit</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Wer ist heute wo? Aktuell für {dateLabel}
            </p>
          </div>

          {bereiche.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Bereich:</span>
              <Select value={selectedBereichId} onValueChange={handleBereichChange}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue />
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
        </div>

        {bereiche.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">Du bist keinem Bereich zugeordnet.</p>
            <p className="text-xs mt-1">
              Bitte wende dich an einen Admin, um einem Bereich zugeordnet zu werden.
            </p>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">Keine Werkstudenten in diesem Bereich.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {[...arbeitsortGroups.entries()].map(([label, grpMembers]) => (
              <GruppenSection key={`arbeitsort-${label}`} label={label} members={grpMembers} {...sharedProps} />
            ))}
            {[...absenceGroups.entries()].map(([label, grpMembers]) => (
              <GruppenSection key={`absence-${label}`} label={label} members={grpMembers} {...sharedProps} />
            ))}
            {noStatus.length > 0 && (
              <GruppenSection label="Abwesend" members={noStatus} {...sharedProps} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
