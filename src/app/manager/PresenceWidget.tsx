import Link from 'next/link'
import { getManagerBereiche, getTeamPresenceForBereich } from './team/actions'
import type { PersonPresence } from '@/app/dashboard/team/actions'

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function groupMembers(members: PersonPresence[]) {
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

  return { arbeitsortGroups, absenceGroups, noStatus }
}

function MemberCard({ person }: { person: PersonPresence }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
        {getInitials(person.full_name)}
      </div>
      <p className="text-sm font-medium text-slate-800 truncate flex-1">{person.full_name ?? 'Unbekannt'}</p>
      {person.sub_location_name && (
        <span className="text-xs font-mono bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 flex-shrink-0">
          {person.sub_location_name}
        </span>
      )}
    </div>
  )
}

function GroupSection({ label, members }: { label: string; members: PersonPresence[] }) {
  if (members.length === 0) return null
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {label}
        <span className="ml-1.5 text-slate-400 font-normal normal-case">({members.length})</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {members.map((m) => (
          <MemberCard key={m.user_id} person={m} />
        ))}
      </div>
    </div>
  )
}

export default async function PresenceWidget() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const bereiche = await getManagerBereiche()

  if (bereiche.length === 0) return null

  const presenceResults = await Promise.all(
    bereiche.map(async (b) => {
      const res = await getTeamPresenceForBereich(b.id, today)
      return { bereich: b, data: res.data }
    })
  )

  const multipleTeams = bereiche.length > 1

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Team-Anwesenheit heute</h2>
        <Link
          href="/manager/team"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Vollansicht →
        </Link>
      </div>

      <div className="space-y-4">
        {presenceResults.map(({ bereich, data }) => {
          if (!data) return null
          const team = data.teams[0]
          if (!team) return null

          const { arbeitsortGroups, absenceGroups, noStatus } = groupMembers(team.members)
          const total = team.members.length

          return (
            <div key={bereich.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              {multipleTeams && (
                <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">
                  {bereich.name}
                </h3>
              )}

              {total === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">
                  Keine Werkstudenten in diesem Bereich
                </p>
              ) : (
                <div className="space-y-4">
                  {[...arbeitsortGroups.entries()].map(([label, members]) => (
                    <GroupSection key={`a-${label}`} label={label} members={members} />
                  ))}
                  {[...absenceGroups.entries()].map(([label, members]) => (
                    <GroupSection key={`ab-${label}`} label={label} members={members} />
                  ))}
                  {noStatus.length > 0 && (
                    <GroupSection label="Abwesend" members={noStatus} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
