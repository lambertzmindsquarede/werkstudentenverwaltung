import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getISOWeekString } from '@/lib/week-utils'
import { loadKalenderWeek } from './actions'
import KalenderGrid from '@/components/kalender/KalenderGrid'

interface Props {
  searchParams: Promise<{ week?: string }>
}

export default async function KalenderPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  // Compute today in Berlin timezone first, then derive weekStr from it.
  // Using the Berlin date as input avoids the UTC-midnight edge case between
  // 00:00–02:00 Berlin time where the server's local date lags one day behind.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const weekStr = params.week ?? getISOWeekString(new Date(today + 'T12:00:00Z'))

  const result = await loadKalenderWeek(weekStr)

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
      weekStr={weekStr}
      today={today}
    />
  )
}
