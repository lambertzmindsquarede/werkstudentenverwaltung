'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase-browser'
import StempelCard from './StempelCard'
import OffenerEintragBanner from './OffenerEintragBanner'
import WochenIstübersicht from './WochenIstübersicht'
import IstEintragEditDialog from './IstEintragEditDialog'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type { ActualEntry, PlannedEntry } from '@/lib/database.types'

interface Props {
  userId: string
  weekStr: string
  today: string
  isWeekend: boolean
  weeklyHourLimit: number
  initialTodayEntries: ActualEntry[]
  initialWeekEntries: ActualEntry[]
  initialPlannedEntries: PlannedEntry[]
  initialOpenEntry: ActualEntry | null
}

export default function DashboardContent({
  userId,
  weekStr: initialWeekStr,
  today,
  isWeekend,
  weeklyHourLimit,
  initialTodayEntries,
  initialWeekEntries,
  initialPlannedEntries,
  initialOpenEntry,
}: Props) {
  const [signingOut, setSigningOut] = useState(false)
  const [currentWeekStr, setCurrentWeekStr] = useState(initialWeekStr)
  const [todayEntries, setTodayEntries] = useState<ActualEntry[]>(initialTodayEntries)
  const [actualEntries, setActualEntries] = useState<ActualEntry[]>(initialWeekEntries)
  const [plannedEntries, setPlannedEntries] = useState<PlannedEntry[]>(initialPlannedEntries)
  const [openEntry, setOpenEntry] = useState<ActualEntry | null>(initialOpenEntry)
  const [weekLoading, setWeekLoading] = useState(false)
  const [openEntryEditDate, setOpenEntryEditDate] = useState<string | null>(null)

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

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <Button
          onClick={handleSignOut}
          disabled={signingOut}
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-slate-700"
        >
          {signingOut ? 'Abmelden…' : 'Abmelden'}
        </Button>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          <a
            href="/dashboard"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600"
          >
            Dashboard
          </a>
          <a
            href="/dashboard/wochenplanung"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Wochenplanung
          </a>
          <a
            href="/dashboard/profile"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Mein Profil
          </a>
        </div>
      </nav>

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
            isWeekend={isWeekend}
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
