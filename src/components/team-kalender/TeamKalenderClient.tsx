'use client'

import { useState, useEffect, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  loadTeamKalenderWeek,
  type TeamKalenderWeekData,
} from '@/app/dashboard/team-kalender/actions'
import {
  getWeekDates,
  dateToString,
  getPreviousWeek,
  getNextWeek,
  getCalendarWeekNumber,
  getWeekDateRange,
} from '@/lib/week-utils'
import { fetchHolidaysForDates } from '@/hooks/usePublicHolidays'
import { DEFAULT_BUNDESLAND } from '@/lib/bundesland-utils'
import TeamKalenderZelle from './TeamKalenderZelle'
import { sortMembersOwnFirst, getInitials, formatHours } from './utils'
import type { PlannedEntry } from '@/lib/database.types'

const WEEKDAY_LABELS = ['MO', 'DI', 'MI', 'DO', 'FR']

interface Props {
  userId: string
  today: string
  /** Aktuelle KW — vom Server berechnet; weiter zurück kann nicht geblättert werden. */
  currentWeek: string
  initialData: TeamKalenderWeekData | null
  initialError: string | null
}

export default function TeamKalenderClient({
  userId,
  today,
  currentWeek,
  initialData,
  initialError,
}: Props) {
  const [weekStr, setWeekStr] = useState(initialData?.weekStr ?? currentWeek)
  const [data, setData] = useState<TeamKalenderWeekData | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [holidayMaps, setHolidayMaps] = useState<Map<string, Map<string, string>>>(new Map())
  const [isPending, startTransition] = useTransition()

  const weekDates = getWeekDates(weekStr).map(dateToString)
  const weekDayDates = getWeekDates(weekStr)

  // Feiertage pro Bundesland der Teammitglieder laden (Muster aus der Manager-Ansicht)
  useEffect(() => {
    if (!data?.members.length) return
    let cancelled = false
    const bundeslaender = [
      ...new Set(data.members.map((m) => (m.bundesland ?? DEFAULT_BUNDESLAND).toUpperCase())),
    ]
    Promise.all(
      bundeslaender.map(async (bl) => [bl, await fetchHolidaysForDates(bl, weekDates)] as const)
    )
      .then((entries) => {
        if (!cancelled) setHolidayMaps(new Map(entries))
      })
      .catch(() => {
        // Feiertage sind Zusatzinfo — Fehler hier nicht blockierend behandeln
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.members, weekStr])

  function getHolidayName(bundesland: string | null, date: string): string | null {
    const bl = (bundesland ?? DEFAULT_BUNDESLAND).toUpperCase()
    return holidayMaps.get(bl)?.get(date) ?? null
  }

  function changeWeek(newWeek: string) {
    startTransition(async () => {
      const result = await loadTeamKalenderWeek(newWeek)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.data) {
        setError(null)
        setData(result.data)
        setWeekStr(result.data.weekStr)
      }
    })
  }

  const canGoBack = weekStr > currentWeek
  const members = data ? sortMembersOwnFirst(data.members, userId) : []

  const plannedByUserAndDate = new Map<string, PlannedEntry[]>()
  if (data) {
    for (const p of data.planned) {
      const key = `${p.user_id}|${p.date}`
      const list = plannedByUserAndDate.get(key) ?? []
      list.push(p)
      plannedByUserAndDate.set(key, list)
    }
  }
  const absentSet = new Set(data?.teamAbsences.map((a) => `${a.user_id}|${a.date}`) ?? [])
  const ownAbsenceByDate = new Map(data?.ownAbsences.map((a) => [a.date, a]) ?? [])

  return (
    <div className="space-y-4">
      {/* Wochennavigation */}
      <div className="flex items-center justify-end">
        <div className="flex items-center rounded-md border border-slate-200 bg-white">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changeWeek(getPreviousWeek(weekStr))}
            disabled={!canGoBack || isPending}
            aria-label="Vorherige Woche"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm font-medium text-slate-700 whitespace-nowrap">
            KW {getCalendarWeekNumber(weekStr)} · {getWeekDateRange(weekStr)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changeWeek(getNextWeek(weekStr))}
            disabled={isPending}
            aria-label="Nächste Woche"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Team-Kalender konnte nicht geladen werden</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => changeWeek(weekStr)} disabled={isPending}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {data?.noBereich && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <Users className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Du bist keinem Bereich zugeordnet</p>
          <p className="text-slate-400 text-sm mt-1">
            Sobald dich dein Manager einem Bereich zuordnet, siehst du hier den Wochenkalender
            deiner Kollegen.
          </p>
        </div>
      )}

      {data && !data.noBereich && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="min-w-[720px]">
              {/* Kopfzeile */}
              <div
                className="grid border-b border-slate-200"
                style={{ gridTemplateColumns: '200px repeat(5, 1fr)' }}
              >
                <div className="px-4 py-3 text-xs font-semibold text-slate-500 tracking-wide">
                  WERKSTUDENT
                </div>
                {weekDayDates.map((d, i) => {
                  const dateStr = dateToString(d)
                  return (
                    <div key={dateStr} className="px-2 py-3 text-center">
                      <div
                        className={`text-xs font-semibold tracking-wide ${
                          dateStr === today ? 'text-blue-600' : 'text-slate-500'
                        }`}
                      >
                        {WEEKDAY_LABELS[i]}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${
                          dateStr === today ? 'text-blue-500 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {String(d.getDate()).padStart(2, '0')}.
                        {String(d.getMonth() + 1).padStart(2, '0')}.
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Zeilen */}
              {members.map((m) => {
                const isOwnRow = m.id === userId
                return (
                  <div
                    key={m.id}
                    className={`grid border-b border-slate-100 last:border-b-0 ${
                      isOwnRow ? 'bg-blue-50/40' : ''
                    }`}
                    style={{ gridTemplateColumns: '200px repeat(5, 1fr)' }}
                  >
                    <div className="px-4 py-3 flex items-center gap-3 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        {getInitials(m.full_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {m.full_name ?? 'Unbekannt'}
                          {isOwnRow && <span className="text-slate-400 font-normal"> (Ich)</span>}
                        </div>
                        {m.weekly_hours != null && (
                          <div className="text-xs text-slate-400">{formatHours(m.weekly_hours)}/Woche</div>
                        )}
                      </div>
                    </div>
                    {weekDates.map((dateStr) => (
                      <div key={dateStr} className="p-1.5">
                        <TeamKalenderZelle
                          plans={plannedByUserAndDate.get(`${m.id}|${dateStr}`) ?? []}
                          absent={!isOwnRow && absentSet.has(`${m.id}|${dateStr}`)}
                          ownAbsence={isOwnRow ? ownAbsenceByDate.get(dateStr) ?? null : null}
                          holidayName={getHolidayName(m.bundesland, dateStr)}
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {members.length === 1 && (
            <p className="text-sm text-slate-400 text-center">
              Noch keine weiteren Kollegen in deinem Bereich.
            </p>
          )}
        </>
      )}
    </div>
  )
}
