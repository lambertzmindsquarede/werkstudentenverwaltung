import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import WerkstudentNav from '@/components/werkstudent/WerkstudentNav'
import { getTeamPresence, getTodayPlannedArbeitsort } from './actions'
import TeamAnwesenheitClient from '@/components/team/TeamAnwesenheitClient'

export const dynamic = 'force-dynamic'

export default async function TeamAnwesenheitPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now)

  const [presenceResult, arbeitsortResult] = await Promise.all([
    getTeamPresence(today),
    getTodayPlannedArbeitsort(today),
  ])

  const initialData = presenceResult.data ?? { me: null, teams: [] }
  const todayArbeitsortId = arbeitsortResult.data?.arbeitsort_id ?? null

  return (
    <div className="min-h-screen bg-slate-50">
      <WerkstudentNav />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Team-Anwesenheit</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Wer ist heute wo? Aktuell für{' '}
            {new Intl.DateTimeFormat('de-DE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(now)}
          </p>
        </div>

        <TeamAnwesenheitClient
          userId={user.id}
          today={today}
          initialData={initialData}
          todayArbeitsortId={todayArbeitsortId}
        />
      </main>
    </div>
  )
}
