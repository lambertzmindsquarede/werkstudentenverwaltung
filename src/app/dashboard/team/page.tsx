import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-server'
import { ManagerSignOutButton } from '@/components/ManagerSignOutButton'
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
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <ManagerSignOutButton />
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          <a
            href="/dashboard"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
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
            href="/dashboard/team"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600"
          >
            Team
          </a>
          <a
            href="/dashboard/profile"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Mein Profil
          </a>
        </div>
      </nav>

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
