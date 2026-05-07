import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getISOWeekString } from '@/lib/week-utils'
import { loadKalenderWeek } from './actions'
import { getBereicheForAssignment } from '@/app/admin/bereiche/actions'
import KalenderGrid from '@/components/kalender/KalenderGrid'
import type { Bereich } from '@/lib/database.types'

interface Props {
  searchParams: Promise<{ week?: string; bereich?: string }>
}

export default async function KalenderPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const weekStr = params.week ?? getISOWeekString(new Date(today + 'T12:00:00Z'))
  const bereichFilter = params.bereich ?? null

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = currentProfile?.is_admin ?? false

  let bereiche: Bereich[] = []
  try {
    bereiche = await getBereicheForAssignment()
  } catch {
    bereiche = []
  }

  const result = await loadKalenderWeek(weekStr, bereichFilter)

  if (result.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-red-600 text-sm">Fehler: {result.error}</p>
      </div>
    )
  }

  return (
    <KalenderGrid
      key={weekStr}
      profiles={result.data!.profiles}
      planned={result.data!.planned}
      actual={result.data!.actual}
      absences={result.data!.absences}
      weekStr={weekStr}
      today={today}
      isAdmin={isAdmin}
      bereiche={bereiche}
      selectedBereich={bereichFilter}
    />
  )
}
