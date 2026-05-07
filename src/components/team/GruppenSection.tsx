import type { PersonPresence, SubLocation } from '@/app/dashboard/team/actions'
import PersonenKarte from './PersonenKarte'

interface Props {
  label: string
  members: PersonPresence[]
  currentUserId: string
  subLocations: SubLocation[]
  todayArbeitsortId: string | null
  onSetSubLocation: (subLocationId: string | null) => Promise<{ error?: string }>
}

export default function GruppenSection({
  label,
  members,
  currentUserId,
  subLocations,
  todayArbeitsortId,
  onSetSubLocation,
}: Props) {
  if (members.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
        {label}
        <span className="ml-2 text-slate-400 font-normal normal-case">
          ({members.length})
        </span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {members.map((person) => {
          const isMe = person.user_id === currentUserId
          const hasPlannedDay = isMe && todayArbeitsortId !== null
          const isAbsent = person.group_type === 'absence'
          return (
            <PersonenKarte
              key={person.user_id}
              person={person}
              isMe={isMe}
              subLocations={isMe ? subLocations : []}
              hasPlannedDay={hasPlannedDay}
              isAbsent={isAbsent}
              onSetSubLocation={onSetSubLocation}
            />
          )
        })}
      </div>
    </div>
  )
}
