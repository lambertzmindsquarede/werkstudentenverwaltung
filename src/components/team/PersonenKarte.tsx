'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import SubOrtDialog from './SubOrtDialog'
import EmojiPickerPopover from '@/components/zeiterfassung/EmojiPickerPopover'
import type { SubLocation, PersonPresence } from '@/app/dashboard/team/actions'

interface Props {
  person: PersonPresence
  isMe: boolean
  subLocations: SubLocation[]
  hasPlannedDay: boolean
  isAbsent: boolean
  onSetSubLocation: (subLocationId: string | null) => Promise<{ error?: string }>
  onSetMoodEmoji?: (emoji: string | null) => Promise<{ error?: string }>
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function PersonenKarte({
  person,
  isMe,
  subLocations,
  hasPlannedDay,
  isAbsent,
  onSetSubLocation,
  onSetMoodEmoji,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const canSetEmoji = isMe && onSetMoodEmoji !== undefined && person.group_type === 'arbeitsort'

  const canSetSubOrt = isMe && !isAbsent && hasPlannedDay
  const circleDisabled = isMe && (!hasPlannedDay || isAbsent)

  const disabledReason = isAbsent
    ? 'Bei Abwesenheit kann kein Arbeitsplatz gesetzt werden.'
    : 'Heute kein Arbeitstag geplant.'

  return (
    <div
      className={`
        flex items-center gap-3 bg-white rounded-xl border px-4 py-3 shadow-sm
        ${isMe ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'}
      `}
    >
      {/* Avatar — clickable emoji picker for own card when stamped in */}
      {canSetEmoji ? (
        <EmojiPickerPopover
          selected={person.mood_emoji}
          onSelect={(emoji) => onSetMoodEmoji!(emoji)}
          trigger={
            <button
              className={`
                w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                ring-offset-1 hover:ring-2 hover:ring-blue-300 transition-all cursor-pointer
                ${person.mood_emoji ? '' : 'bg-blue-100 text-blue-700 text-sm font-semibold'}
              `}
              title="Stimmung ändern"
            >
              {person.mood_emoji
                ? <span className="text-2xl leading-none">{person.mood_emoji}</span>
                : getInitials(person.full_name)
              }
            </button>
          }
        />
      ) : (
        <div
          className={`
            w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
            ${person.mood_emoji ? '' : isMe ? 'bg-blue-100 text-blue-700 text-sm font-semibold' : 'bg-slate-100 text-slate-600 text-sm font-semibold'}
          `}
        >
          {person.mood_emoji
            ? <span className="text-2xl leading-none">{person.mood_emoji}</span>
            : getInitials(person.full_name)
          }
        </div>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isMe ? 'text-blue-900' : 'text-slate-800'}`}>
          {person.full_name ?? 'Unbekannt'}
          {isMe && <span className="ml-1 text-xs text-blue-500 font-normal">(Ich)</span>}
        </p>
      </div>

      {/* Sub-location indicator — hidden when absent (absence takes precedence) */}
      {!isAbsent && person.sub_location_name ? (
        <button
          onClick={() => canSetSubOrt && setDialogOpen(true)}
          disabled={!canSetSubOrt}
          className={`flex-shrink-0 ${canSetSubOrt ? 'cursor-pointer' : 'cursor-default'}`}
          aria-label={isMe ? 'Arbeitsplatz ändern' : undefined}
        >
          <Badge
            variant="secondary"
            className="font-mono text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            {person.sub_location_name}
          </Badge>
        </button>
      ) : isMe ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => canSetSubOrt && setDialogOpen(true)}
                disabled={circleDisabled}
                className={`
                  w-6 h-6 rounded-full border-2 flex-shrink-0 transition-colors
                  ${circleDisabled
                    ? 'border-slate-200 cursor-not-allowed opacity-40'
                    : 'border-slate-300 hover:border-blue-400 cursor-pointer'
                  }
                `}
                aria-label="Arbeitsplatz setzen"
              />
            </TooltipTrigger>
            {circleDisabled && (
              <TooltipContent>
                <p className="text-xs">{disabledReason}</p>
              </TooltipContent>
            )}
            {!circleDisabled && (
              <TooltipContent>
                <p className="text-xs">Arbeitsplatz setzen</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 flex-shrink-0 opacity-50" />
      )}

      {/* Sub-ort dialog (own card only) */}
      {isMe && (
        <SubOrtDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          subLocations={subLocations}
          currentSubLocationId={person.sub_location_id}
          onSelect={onSetSubLocation}
          disabled={!canSetSubOrt}
          disabledReason={disabledReason}
        />
      )}
    </div>
  )
}
