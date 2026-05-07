'use client'

import { useMemo, useState } from 'react'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Profile, PlannedEntry } from '@/lib/database.types'
import { getUserColor } from './DeckungsGrid'

const BLOCK_HEIGHT = 32

function timeToMinutes(t: string): number {
  const parts = t.split(':').map(Number)
  return parts[0] * 60 + parts[1]
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
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

function offsetDay(day: string, delta: number): string {
  const d = new Date(day + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().split('T')[0]
}

function isWeekday(day: string): boolean {
  const dow = new Date(day + 'T12:00:00Z').getUTCDay()
  return dow >= 1 && dow <= 5
}

interface Props {
  profiles: Profile[]
  planned: PlannedEntry[]
  day: string
  today: string
  onDayNavigate: (day: string) => void
}

export default function TagesGantt({ profiles, planned, day, today, onDayNavigate }: Props) {
  const [selectedBlock, setSelectedBlock] = useState<LaneBlock | null>(null)

  const dayPlanned = useMemo(() => planned.filter((e) => e.date === day), [planned, day])
  const { axisStart, axisEnd } = useMemo(() => computeAxisRange(dayPlanned), [dayPlanned])
  const totalMin = axisEnd - axisStart

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>()
    for (const p of profiles) m.set(p.id, p)
    return m
  }, [profiles])

  // 15-min ticks, show label for full hours and :30
  const ticks = useMemo(() => {
    const result: number[] = []
    const start = Math.floor(axisStart / 15) * 15
    const end = Math.ceil(axisEnd / 15) * 15
    for (let m = start; m <= end; m += 15) result.push(m)
    return result
  }, [axisStart, axisEnd])

  const blocks = useMemo(
    () =>
      dayPlanned
        .map((e) => ({
          entry: e,
          profile: profileMap.get(e.user_id)!,
          startMin: timeToMinutes(e.planned_start),
          endMin: timeToMinutes(e.planned_end),
        }))
        .filter((b) => b.profile),
    [dayPlanned, profileMap]
  )

  const lanes = useMemo(() => assignLanes(blocks), [blocks])
  const numRows = lanes.length > 0 ? Math.max(...lanes.map((l) => l.row)) + 1 : 1
  const timelineHeight = Math.max(numRows * BLOCK_HEIGHT + 16, 72)

  const isToday = day === today
  const nowMinutes = useMemo(() => {
    if (!isToday) return null
    const berlinTime = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())
    return timeToMinutes(berlinTime)
  }, [isToday])

  const prevDay = useMemo(() => {
    const prev = offsetDay(day, -1)
    return isWeekday(prev) ? prev : null
  }, [day])

  const nextDay = useMemo(() => {
    const next = offsetDay(day, 1)
    return isWeekday(next) ? next : null
  }, [day])

  const dayDate = new Date(day + 'T12:00:00Z')
  const dayLabel = dayDate.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <TooltipProvider>
      <div className="bg-white rounded-lg border border-slate-200">
        {/* Day navigation */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => prevDay && onDayNavigate(prevDay)}
            disabled={!prevDay}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium text-slate-900 min-w-48 text-center">
            {dayLabel}
            {isToday && (
              <span className="ml-2 text-xs text-blue-600 font-medium">(heute)</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => nextDay && onDayNavigate(nextDay)}
            disabled={!nextDay}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: '700px' }}>
            {/* Tick header */}
            <div className="relative h-9 border-b border-slate-200 mx-4">
              {ticks.map((tick) => {
                const left = ((tick - axisStart) / totalMin) * 100
                const isHour = tick % 60 === 0
                const isHalf = tick % 30 === 0 && !isHour
                if (!isHour && !isHalf) return null
                return (
                  <div
                    key={tick}
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
                  >
                    <div
                      className={`border-l ${
                        isHour ? 'h-4 border-slate-300' : 'h-2 border-slate-200'
                      }`}
                    />
                    <span className={`text-xs mt-0.5 ${isHour ? 'text-slate-500' : 'text-slate-300'}`}>
                      {isHour
                        ? `${String(Math.floor(tick / 60)).padStart(2, '0')}:00`
                        : ':30'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Timeline body */}
            <div
              className="relative mx-4 my-2"
              style={{ height: `${timelineHeight}px` }}
            >
              {/* Grid lines for all 15-min ticks */}
              {ticks.map((tick) => {
                const left = ((tick - axisStart) / totalMin) * 100
                const isHour = tick % 60 === 0
                return (
                  <div
                    key={tick}
                    className={`absolute top-0 bottom-0 border-l ${
                      isHour ? 'border-slate-200' : 'border-slate-100'
                    }`}
                    style={{ left: `${left}%` }}
                  />
                )
              })}

              {/* Current time marker */}
              {nowMinutes !== null &&
                nowMinutes >= axisStart &&
                nowMinutes <= axisEnd && (
                  <div
                    className="absolute top-0 bottom-0 z-10"
                    style={{ left: `${((nowMinutes - axisStart) / totalMin) * 100}%` }}
                  >
                    <div className="relative h-full">
                      <div className="absolute top-0 left-0 w-0.5 h-full bg-red-400" />
                      <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-red-400" />
                    </div>
                  </div>
                )}

              {/* Empty state */}
              {lanes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm text-slate-400">Keine Planung für diesen Tag</span>
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
                const isShort = width < 7

                return (
                  <Tooltip key={entry.id} delayDuration={200}>
                    <TooltipTrigger asChild>
                      <div
                        className={`absolute flex items-center rounded cursor-pointer hover:opacity-90 transition-opacity overflow-hidden text-xs font-medium ${color.bg} ${color.text}`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 0.8)}%`,
                          top: `${row * BLOCK_HEIGHT + 4}px`,
                          height: `${BLOCK_HEIGHT - 6}px`,
                        }}
                        onClick={() =>
                          setSelectedBlock({ entry, profile, startMin, endMin, row })
                        }
                      >
                        {!isShort && (
                          <span className="px-2 truncate">
                            {firstName} {minutesToTime(startMin)}–{minutesToTime(endMin)}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-medium">{profile.full_name ?? profile.email}</p>
                      <p className="text-xs">
                        {minutesToTime(startMin)} – {minutesToTime(endMin)} ({durationH.toFixed(1)}h)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedBlock} onOpenChange={() => setSelectedBlock(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedBlock?.profile.full_name ?? selectedBlock?.profile.email}
            </DialogTitle>
          </DialogHeader>
          {selectedBlock && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Von</span>
                <span className="font-medium">{minutesToTime(selectedBlock.startMin)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Bis</span>
                <span className="font-medium">{minutesToTime(selectedBlock.endMin)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Gesamt</span>
                <span className="font-medium">
                  {((selectedBlock.endMin - selectedBlock.startMin) / 60).toFixed(1)}h
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
