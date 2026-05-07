'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase-browser'
import WerkstudentNav from '@/components/werkstudent/WerkstudentNav'
import StempelCard from './StempelCard'
import OffenerEintragBanner from './OffenerEintragBanner'
import WochenIstübersicht from './WochenIstübersicht'
import IstEintragEditDialog from './IstEintragEditDialog'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type { ActualEntry, PlannedEntry, AbsenceWithType } from '@/lib/database.types'

interface Props {
  userId: string
  weekStr: string
  today: string
  isWeekend: boolean
  weeklyHourLimit: number
  bundesland: string
  maxEditDaysPast: number | null
  hasManager: boolean
  initialTodayEntries: ActualEntry[]
  initialWeekEntries: ActualEntry[]
  initialPlannedEntries: PlannedEntry[]
  initialOpenEntry: ActualEntry | null
  todayAbsence: AbsenceWithType | null
  arbeitsorte: { id: string; name: string }[]
  initialTodayArbeitsortId: string | null
  hasTodayPlan: boolean
}

export default function DashboardContent({
  userId,
  weekStr: initialWeekStr,
  today,
  isWeekend,
  weeklyHourLimit,
  bundesland,
  maxEditDaysPast,
  hasManager,
  initialTodayEntries,
  initialWeekEntries,
  initialPlannedEntries,
  initialOpenEntry,
  todayAbsence,
  arbeitsorte,
  initialTodayArbeitsortId,
  hasTodayPlan,
}: Props) {
  const [currentWeekStr, setCurrentWeekStr] = useState(initialWeekStr)
  const [todayEntries, setTodayEntries] = useState<ActualEntry[]>(initialTodayEntries)
  const [actualEntries, setActualEntries] = useState<ActualEntry[]>(initialWeekEntries)
  const [plannedEntries, setPlannedEntries] = useState<PlannedEntry[]>(initialPlannedEntries)
  const [openEntry, setOpenEntry] = useState<ActualEntry | null>(initialOpenEntry)
  const [weekLoading, setWeekLoading] = useState(false)
  const [openEntryEditDate, setOpenEntryEditDate] = useState<string | null>(null)
  const [todayArbeitsortId, setTodayArbeitsortId] = useState<string | null>(initialTodayArbeitsortId)

  useEffect(() => {
    if (currentWeekStr === initialWeekStr) return
    fetchWeekData(currentWeekStr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekStr])

  async function fetchWeekData(week: string) {
    setWeekLoading(true)
    const supabase = createClient()
    const weekDates = getWeekDates(week)
    const weekStart = dateToString(weekDates[0])
    const weekEnd = dateToString(weekDates[4])

    const [actualResult, plannedResult] = await Promise.all([
      supabase
        .from('actual_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', weekStart)
        .lte('date', weekEnd),
      supabase
        .from('planned_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', weekStart)
        .lte('date', weekEnd),
    ])

    setActualEntries((actualResult.data as ActualEntry[] | null) ?? [])
    setPlannedEntries((plannedResult.data as PlannedEntry[] | null) ?? [])
    setWeekLoading(false)
  }

  function upsertEntry(list: ActualEntry[], entry: ActualEntry): ActualEntry[] {
    const idx = list.findIndex((e) => e.id === entry.id)
    if (idx >= 0) {
      const next = [...list]
      next[idx] = entry
      return next
    }
    return [...list, entry]
  }

  function handleStampEntry(entry: ActualEntry) {
    setTodayEntries((prev) => upsertEntry(prev, entry))
    if (currentWeekStr === initialWeekStr) {
      setActualEntries((prev) => upsertEntry(prev, entry))
    }
  }

  function handleStampEntryDeleted(entryId: string) {
    setTodayEntries((prev) => prev.filter((e) => e.id !== entryId))
    setActualEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  function handleEntryChange(entry: ActualEntry) {
    setActualEntries((prev) => upsertEntry(prev, entry))
    if (openEntry && entry.id === openEntry.id && entry.is_complete) {
      setOpenEntry(null)
    }
    if (entry.date === today) {
      setTodayEntries((prev) => upsertEntry(prev, entry))
    }
  }

  function handleEntryDeleted(entryId: string) {
    setActualEntries((prev) => prev.filter((e) => e.id !== entryId))
    if (openEntry?.id === entryId) setOpenEntry(null)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <WerkstudentNav />

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Mein Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">Deine Arbeitszeiten auf einen Blick</p>
        </div>

        {/* Open entry banner */}
        {openEntry && (
          <OffenerEintragBanner
            entry={openEntry}
            onEditClick={() => setOpenEntryEditDate(openEntry.date)}
          />
        )}

        {/* Stamp card */}
        <div className="mb-8">
          <StempelCard
            todayEntries={todayEntries}
            today={today}
            isWeekend={isWeekend}
            bundesland={bundesland}
            todayAbsence={todayAbsence}
            arbeitsorte={arbeitsorte}
            todayArbeitsortId={todayArbeitsortId}
            hasTodayPlan={hasTodayPlan}
            onArbeitsortChange={setTodayArbeitsortId}
            onEntryChange={handleStampEntry}
            onEntryDeleted={handleStampEntryDeleted}
          />
        </div>

        {/* Weekly overview */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Wochenübersicht Ist-Zeiten
          </h2>
          {weekLoading ? (
            <p className="text-sm text-slate-400">Lade Daten…</p>
          ) : (
            <WochenIstübersicht
              weekStr={currentWeekStr}
              today={today}
              weeklyHourLimit={weeklyHourLimit}
              maxEditDaysPast={maxEditDaysPast}
              hasManager={hasManager}
              actualEntries={actualEntries}
              plannedEntries={plannedEntries}
              onWeekChange={setCurrentWeekStr}
              onEntryChange={handleEntryChange}
              onEntryDeleted={handleEntryDeleted}
            />
          )}
        </div>
      </main>

      {/* Open entry edit dialog (triggered from banner) */}
      {openEntryEditDate && (
        <IstEintragEditDialog
          open
          date={openEntryEditDate}
          entry={openEntry}
          showManagerNotice={hasManager && openEntryEditDate < today}
          onClose={() => setOpenEntryEditDate(null)}
          onSaved={(entry) => {
            handleEntryChange(entry)
            setOpenEntryEditDate(null)
          }}
        />
      )}
    </div>
  )
}
