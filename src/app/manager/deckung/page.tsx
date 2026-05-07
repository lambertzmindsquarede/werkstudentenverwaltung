import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getISOWeekString } from '@/lib/week-utils'
import { loadDeckungWeek } from './actions'
import { getBereicheForAssignment } from '@/app/admin/bereiche/actions'
import DeckungsGrid from '@/components/deckung/DeckungsGrid'
import type { Bereich } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ week?: string; view?: string; day?: string; bereich?: string }>
}

export default async function DeckungsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const weekStr = params.week ?? getISOWeekString(new Date(today + 'T12:00:00Z'))
  const view = params.view === 'tag' ? 'tag' : ('woche' as 'woche' | 'tag')
  const day = params.day ?? today
  const bereichFilter = params.bereich ?? null

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  const isManager =
    currentProfile?.role === 'manager' || currentProfile?.is_admin
  if (!isManager) redirect('/dashboard')

  const isAdmin = currentProfile?.is_admin ?? false

  let bereiche: Bereich[] = []
  if (isAdmin) {
    try {
      bereiche = await getBereicheForAssignment()
    } catch {
      bereiche = []
    }
  }

  const result = await loadDeckungWeek(weekStr, bereichFilter)

  if (result.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-red-600 text-sm">Fehler: {result.error}</p>
      </div>
    )
  }

  return (
    <DeckungsGrid
      key={`${weekStr}-${view}-${day}`}
      profiles={result.data!.profiles}
      planned={result.data!.planned}
      weekStr={weekStr}
      today={today}
      initialView={view}
      initialDay={day}
      isAdmin={isAdmin}
      bereiche={bereiche}
      selectedBereich={bereichFilter}
    />
  )
}
