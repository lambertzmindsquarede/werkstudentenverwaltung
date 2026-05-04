import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import DashboardContent from '@/components/zeiterfassung/DashboardContent'
import { getCurrentISOWeek, getWeekDates, dateToString } from '@/lib/week-utils'
import type { ActualEntry, PlannedEntry } from '@/lib/database.types'
import { DEFAULT_MAX_EDIT_DAYS_PAST } from '@/lib/database.types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now)
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
  }).format(now)
  const isWeekend = dayName === 'Sat' || dayName === 'Sun'

  const weekStr = getCurrentISOWeek()
  const weekDates = getWeekDates(weekStr)
  const weekStart = dateToString(weekDates[0])
  const weekEnd = dateToString(weekDates[4])

  const [profileResult, todayEntriesResult, weekEntriesResult, plannedEntriesResult, openEntryResult, settingResult] =
    await Promise.all([
      supabase.from('profiles').select('weekly_hour_limit, bundesland, role').eq('id', user.id).single(),
      supabase
        .from('actual_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('block_index', { ascending: true }),
      supabase
        .from('actual_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd),
      supabase
        .from('planned_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd),
      supabase
        .from('actual_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_complete', false)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(1),
      supabase.from('app_settings').select('value').eq('key', 'max_edit_days_past').single(),
    ])

  const isManager = profileResult.data?.role === 'manager'
  const rawDays = settingResult.data ? parseInt(settingResult.data.value, 10) : DEFAULT_MAX_EDIT_DAYS_PAST
  // Managers have no cutoff (null = unrestricted)
  const maxEditDaysPast = isManager ? null : rawDays

  return (
    <DashboardContent
      userId={user.id}
      weekStr={weekStr}
      today={today}
      isWeekend={isWeekend}
      weeklyHourLimit={profileResult.data?.weekly_hour_limit ?? 20}
      bundesland={profileResult.data?.bundesland ?? 'NW'}
      maxEditDaysPast={maxEditDaysPast}
      initialTodayEntries={(todayEntriesResult.data as ActualEntry[] | null) ?? []}
      initialWeekEntries={(weekEntriesResult.data as ActualEntry[] | null) ?? []}
      initialPlannedEntries={(plannedEntriesResult.data as PlannedEntry[] | null) ?? []}
      initialOpenEntry={((openEntryResult.data as ActualEntry[] | null)?.[0]) ?? null}
    />
  )
}
