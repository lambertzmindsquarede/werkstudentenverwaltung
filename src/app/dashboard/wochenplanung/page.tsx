import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import WochenplanungClient from '@/components/wochenplanung/WochenplanungClient'
import { loadWeekEntries, getArbeitsorteForWerkstudent, getLastUsedArbeitsortId } from './actions'
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

  const [{ data: entries }, { data: profile }, { data: arbeitsorte }, lastUsedArbeitsortId] =
    await Promise.all([
      loadWeekEntries(weekStr),
      supabase.from('profiles').select('weekly_hour_limit, bundesland').eq('id', user.id).single(),
      getArbeitsorteForWerkstudent(),
      getLastUsedArbeitsortId(),
    ])

  return (
    <WochenplanungClient
      key={weekStr}
      weekStr={weekStr}
      initialEntries={entries ?? []}
      weeklyHourLimit={profile?.weekly_hour_limit ?? 20}
      bundesland={profile?.bundesland ?? 'NW'}
      arbeitsorte={arbeitsorte ?? []}
      lastUsedArbeitsortId={lastUsedArbeitsortId}
    />
  )
}
