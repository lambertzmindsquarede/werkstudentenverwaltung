'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Skeleton } from '@/components/ui/skeleton'
import GruppenSection from './GruppenSection'
import PersonenKarte from './PersonenKarte'
import type { TeamPresenceData, SubLocation, PersonPresence } from '@/app/dashboard/team/actions'
import {
  getTeamPresence,
  setSubLocation,
  getSubLocationsForArbeitsort,
} from '@/app/dashboard/team/actions'

interface Props {
  userId: string
  today: string
  initialData: TeamPresenceData
  todayArbeitsortId: string | null
}

export default function TeamAnwesenheitClient({
  userId,
  today,
  initialData,
  todayArbeitsortId,
}: Props) {
  const [data, setData] = useState<TeamPresenceData>(initialData)
  const [subLocations, setSubLocations] = useState<SubLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  // Load sub-locations for today's arbeitsort
  useEffect(() => {
    if (!todayArbeitsortId) return
    getSubLocationsForArbeitsort(todayArbeitsortId).then((res) => {
      setSubLocations(res.data ?? [])
    })
  }, [todayArbeitsortId])

  const refresh = useCallback(async () => {
    const res = await getTeamPresence(today)
    if (res.data) setData(res.data)
  }, [today])

  // Supabase Realtime subscription on daily_presence
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('team_presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_presence' },
        () => {
          startTransition(() => {
            refresh()
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  async function handleSetSubLocation(subLocationId: string | null) {
    const result = await setSubLocation(subLocationId, today)
    if (!result.error) {
      await refresh()
    }
    return result
  }

  const multipleTeams = data.teams.length > 1
  const mePresence = data.me

  const sharedProps = {
    currentUserId: userId,
    subLocations,
    todayArbeitsortId,
    onSetSubLocation: handleSetSubLocation,
  }

  // Check if me is already in a team (normal case) — only show fallback "Ich" when not in any team
  const meInTeams = data.teams.some((t) => t.members.some((m) => m.user_id === userId))

  return (
    <div className="space-y-8">
      {/* Fallback: Ich-Sektion nur wenn kein Bereich zugeordnet */}
      {mePresence && !meInTeams && (
        <div>
          <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">
            Ich
          </h2>
          <div className="max-w-xs">
            <PersonenKarte
              person={mePresence}
              isMe={true}
              subLocations={subLocations}
              hasPlannedDay={todayArbeitsortId !== null}
              isAbsent={mePresence.group_type === 'absence'}
              onSetSubLocation={handleSetSubLocation}
            />
          </div>
        </div>
      )}

      {/* Team sections (me included in the groups, identified by "(Ich)" badge) */}
      {data.teams.map((team) => {
        const teamMembers = team.members
        if (teamMembers.length === 0 && !multipleTeams) return null

        const teamArbeitsortGroups = new Map<string, PersonPresence[]>()
        const teamAbsenceGroups = new Map<string, PersonPresence[]>()
        const teamNoStatus: PersonPresence[] = []

        for (const m of teamMembers) {
          if (m.group_type === 'arbeitsort') {
            const arr = teamArbeitsortGroups.get(m.group_label) ?? []
            arr.push(m)
            teamArbeitsortGroups.set(m.group_label, arr)
          } else if (m.group_type === 'absence') {
            const arr = teamAbsenceGroups.get(m.group_label) ?? []
            arr.push(m)
            teamAbsenceGroups.set(m.group_label, arr)
          } else {
            teamNoStatus.push(m)
          }
        }

        return (
          <div key={team.bereich_id} className="space-y-4">
            {multipleTeams && (
              <h2 className="text-base font-semibold text-slate-700 border-b border-slate-200 pb-2">
                {team.bereich_name}
              </h2>
            )}

            {[...teamArbeitsortGroups.entries()].map(([label, members]) => (
              <GruppenSection
                key={`arbeitsort-${label}`}
                label={label}
                members={members}
                {...sharedProps}
              />
            ))}

            {[...teamAbsenceGroups.entries()].map(([label, members]) => (
              <GruppenSection
                key={`absence-${label}`}
                label={label}
                members={members}
                {...sharedProps}
              />
            ))}

            {teamNoStatus.length > 0 && (
              <GruppenSection
                label="Abwesend"
                members={teamNoStatus}
                {...sharedProps}
              />
            )}

            {teamMembers.length === 0 && multipleTeams && (
              <p className="text-sm text-slate-400 italic">Keine Teammitglieder heute.</p>
            )}
          </div>
        )
      })}

      {data.teams.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">Du bist keinem Team zugeordnet.</p>
          <p className="text-xs mt-1">Bitte wende dich an deinen Manager.</p>
        </div>
      )}
    </div>
  )
}
