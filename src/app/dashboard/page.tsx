import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import DashboardContent from '@/components/zeiterfassung/DashboardContent'
import { getCurrentISOWeek, getWeekDates, dateToString } from '@/lib/week-utils'
import type { ActualEntry, PlannedEntry } from '@/lib/database.types'

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

  const [profileResult, todayEntryResult, weekEntriesResult, plannedEntriesResult, openEntryResult] =
    await Promise.all([
      supabase.from('profiles').select('weekly_hour_limit').eq('id', user.id).single(),
      supabase
        .from('actual_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle(),
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
    ])

  return (
    <DashboardContent
      userId={user.id}
      weekStr={weekStr}
      today={today}
      isWeekend={isWeekend}
      weeklyHourLimit={profileResult.data?.weekly_hour_limit ?? 20}
      initialTodayEntry={(todayEntryResult.data as ActualEntry | null) ?? null}
      initialWeekEntries={(weekEntriesResult.data as ActualEntry[] | null) ?? []}
      initialPlannedEntries={(plannedEntriesResult.data as PlannedEntry[] | null) ?? []}
      initialOpenEntry={((openEntryResult.data as ActualEntry[] | null)?.[0]) ?? null}
    />
  )
}
