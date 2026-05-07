'use client'

import { useMemo } from 'react'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { Profile, PlannedEntry } from '@/lib/database.types'
import { getUserColor } from './DeckungsGrid'

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']
const BLOCK_HEIGHT = 28

function timeToMinutes(t: string): number {
  const parts = t.split(':').map(Number)
  return parts[0] * 60 + parts[1]
}

function computeAxisRange(planned: PlannedEntry[]): { axisStart: number; axisEnd: number } {
  if (planned.length === 0) return { axisStart: 8 * 60, axisEnd: 18 * 60 }
  let minStart = Infinity
  let maxEnd = -Infinity
  for (const e of planned) {
    minStart = Math.min(minStart, timeToMinutes(e.planned_start))
    maxEnd = Math.max(maxEnd, timeToMinutes(e.planned_end))
  }
  return {
    axisStart: Math.min(minStart - 60, 8 * 60),
    axisEnd: Math.max(maxEnd + 60, 18 * 60),
  }
}

interface LaneBlock {
  entry: PlannedEntry
  profile: Profile
  startMin: number
  endMin: number
  row: number
}

function assignLanes(
  blocks: Array<{ entry: PlannedEntry; profile: Profile; startMin: number; endMin: number }>
): LaneBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin)
  const result: LaneBlock[] = []
  const laneEnds: number[] = []

  for (const block of sorted) {
    let row = laneEnds.findIndex((end) => end <= block.startMin)
    if (row === -1) row = laneEnds.length
    laneEnds[row] = block.endMin
    result.push({ ...block, row })
  }
  return result
}

interface Props {
  profiles: Profile[]
  planned: PlannedEntry[]
  weekDates: string[]
  today: string
  onDayClick: (day: string) => void
}

export default function WochenGantt({ profiles, planned, weekDates, today, onDayClick }: Props) {
  const { axisStart, axisEnd } = useMemo(() => computeAxisRange(planned), [planned])
  const totalMin = axisEnd - axisStart

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>()
    for (const p of profiles) m.set(p.id, p)
    return m
  }, [profiles])

  const hourTicks = useMemo(() => {
    const ticks: number[] = []
    const startH = Math.floor(axisStart / 60)
    const endH = Math.ceil(axisEnd / 60)
    for (let h = startH; h <= endH; h++) ticks.push(h * 60)
    return ticks
  }, [axisStart, axisEnd])

  return (
    <TooltipProvider>
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <div style={{ minWidth: '700px' }}>
          {/* Time axis header */}
          <div className="flex border-b border-slate-200">
            <div className="flex-shrink-0 w-20" />
            <div className="relative flex-1 h-8">
              {hourTicks.map((tick) => {
                const left = ((tick - axisStart) / totalMin) * 100
                const h = Math.floor(tick / 60)
                return (
                  <div
                    key={tick}
                    className="absolute top-0 flex flex-col items-start"
                    style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="h-3 border-l border-slate-300" />
                    <span className="text-xs text-slate-400">{String(h).padStart(2, '0')}:00</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Day rows */}
          {weekDates.map((date, i) => {
            const dayPlanned = planned.filter((e) => e.date === date)
            const blocks = dayPlanned
              .map((e) => ({
                entry: e,
                profile: profileMap.get(e.user_id)!,
                startMin: timeToMinutes(e.planned_start),
                endMin: timeToMinutes(e.planned_end),
              }))
              .filter((b) => b.profile)

            const lanes = assignLanes(blocks)
            const numRows = lanes.length > 0 ? Math.max(...lanes.map((l) => l.row)) + 1 : 1
            const rowHeight = Math.max(numRows * BLOCK_HEIGHT + 12, 48)
            const isToday = date === today
            const [, month, dayNum] = date.split('-')

            return (
              <div
                key={date}
                className={`flex border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-slate-50 transition-colors ${
                  isToday ? 'ring-1 ring-inset ring-blue-300' : ''
                }`}
                style={{ minHeight: `${rowHeight}px` }}
                onClick={() => onDayClick(date)}
                title={`Tagesansicht für ${date} öffnen`}
              >
                {/* Day label */}
                <div
                  className={`flex-shrink-0 w-20 flex flex-col justify-center px-3 py-2 border-r border-slate-100 ${
                    isToday ? 'bg-blue-50' : ''
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}
                  >
                    {DAY_LABELS[i]}
                  </span>
                  <span className="text-xs text-slate-400">
                    {dayNum}.{month}.
                  </span>
                </div>

                {/* Timeline */}
                <div className="relative flex-1 py-1">
                  {/* Grid lines */}
                  {hourTicks.map((tick) => (
                    <div
                      key={tick}
                      className="absolute top-0 bottom-0 border-l border-slate-100"
                      style={{ left: `${((tick - axisStart) / totalMin) * 100}%` }}
                    />
                  ))}

                  {/* Empty day hint */}
                  {lanes.length === 0 && (
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs text-slate-300">keine Planung</span>
                    </div>
                  )}

                  {/* Blocks */}
                  {lanes.map(({ entry, profile, startMin, endMin, row }) => {
                    const left = ((startMin - axisStart) / totalMin) * 100
                    const width = ((endMin - startMin) / totalMin) * 100
                    const color = getUserColor(entry.user_id)
                    const durationH = (endMin - startMin) / 60
                    const firstName =
                      profile.full_name?.split(' ')[0] ?? profile.email?.split('@')[0] ?? '?'
                    const startLabel = `${String(Math.floor(startMin / 60)).padStart(2, '0')}`
                    const endLabel = `${String(Math.floor(endMin / 60)).padStart(2, '0')}`
                    const label = `${firstName} ${startLabel}–${endLabel}`
                    const isShort = width < 8

                    return (
                      <Tooltip key={entry.id} delayDuration={200}>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute flex items-center rounded text-xs font-medium overflow-hidden ${color.bg} ${color.text}`}
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(width, 1)}%`,
                              top: `${row * BLOCK_HEIGHT + 4}px`,
                              height: `${BLOCK_HEIGHT - 4}px`,
                            }}
                          >
                            {!isShort && (
                              <span className="px-1.5 truncate">{label}</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="font-medium">{profile.full_name ?? profile.email}</p>
                          <p className="text-xs">
                            {entry.planned_start.slice(0, 5)} – {entry.planned_end.slice(0, 5)} ({durationH.toFixed(1)}h)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {planned.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-sm">
              Keine Planungen für diese Woche
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
