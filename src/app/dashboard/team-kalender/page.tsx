import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import WerkstudentNav from '@/components/werkstudent/WerkstudentNav'
import TeamKalenderClient from '@/components/team-kalender/TeamKalenderClient'
import { loadTeamKalenderWeek } from './actions'
import { getISOWeekString } from '@/lib/week-utils'

export const dynamic = 'force-dynamic'

export default async function TeamKalenderPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now)
  const currentWeek = getISOWeekString(now)

  const result = await loadTeamKalenderWeek(currentWeek)

  return (
    <div className="min-h-screen bg-slate-50">
      <WerkstudentNav />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Team-Kalender</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Geplante Anwesenheiten deiner Kollegen — aktuelle und kommende Wochen
          </p>
        </div>

        <TeamKalenderClient
          userId={user.id}
          today={today}
          currentWeek={currentWeek}
          initialData={result.data ?? null}
          initialError={result.error ?? null}
        />
      </main>
    </div>
  )
}
