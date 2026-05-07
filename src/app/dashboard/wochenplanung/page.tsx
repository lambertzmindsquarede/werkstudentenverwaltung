import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import WochenplanungClient from '@/components/wochenplanung/WochenplanungClient'
import { loadWeekEntries, getArbeitsorteForWerkstudent, getLastUsedArbeitsortId } from './actions'
import { loadWeekAbsences, getResolvedAbsenceTypes } from './absence-actions'
import { getCurrentISOWeek } from '@/lib/week-utils'

interface Props {
  searchParams: Promise<{ week?: string }>
}

export default async function WochenplanungPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const weekStr = params.week ?? getCurrentISOWeek()

  const [
    { data: entries },
    { data: profile },
    { data: arbeitsorte },
    lastUsedArbeitsortId,
    { data: absences },
    { data: absenceTypes },
  ] = await Promise.all([
    loadWeekEntries(weekStr),
    supabase.from('profiles').select('weekly_hour_limit, bundesland, bereich_id').eq('id', user.id).single(),
    getArbeitsorteForWerkstudent(),
    getLastUsedArbeitsortId(),
    loadWeekAbsences(weekStr),
    getResolvedAbsenceTypes(),
  ])

  // Check if absences are enabled for the user's Bereich (default true if no bereich)
  let absencesEnabled = true
  if (profile?.bereich_id) {
    const { data: bereich } = await supabase
      .from('bereiche')
      .select('absences_enabled')
      .eq('id', profile.bereich_id)
      .single()
    absencesEnabled = bereich?.absences_enabled ?? true
  }

  return (
    <WochenplanungClient
      key={weekStr}
      weekStr={weekStr}
      initialEntries={entries ?? []}
      weeklyHourLimit={profile?.weekly_hour_limit ?? 20}
      bundesland={profile?.bundesland ?? 'NW'}
      arbeitsorte={arbeitsorte ?? []}
      lastUsedArbeitsortId={lastUsedArbeitsortId}
      initialAbsences={absencesEnabled ? (absences ?? []) : []}
      absenceTypes={absencesEnabled ? absenceTypes : []}
      absencesEnabled={absencesEnabled}
    />
  )
}
