import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase-server'
import PresenceWidget from './PresenceWidget'
import ManagerNav from '@/components/manager/ManagerNav'

export const dynamic = 'force-dynamic'

export default async function ManagerPage() {
  const supabase = await createClient()

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())

  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentProfile } = user
    ? await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    : { data: null }
  const isAdmin = currentProfile?.is_admin ?? false

  const [
    { count: activeWerkstudenten, error: err1 },
    { count: pendingUsers, error: err2 },
    { data: todayEntries, error: err3 },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'werkstudent')
      .eq('is_active', true),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .is('role', null),
    supabase
      .from('actual_entries')
      .select('user_id')
      .eq('date', today),
  ])

  if (err1 || err2 || err3) {
    console.error('[Manager] Supabase query errors:', { err1, err2, err3 })
  }

  const todayAnwesend = new Set(todayEntries?.map((e) => e.user_id) ?? []).size

  return (
    <div className="min-h-screen bg-slate-50">
      <ManagerNav isAdmin={isAdmin} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Manager-Übersicht</h1>
          <p className="text-slate-500 mt-1 text-sm">Anwesenheiten und Stunden deiner Werkstudenten</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Aktive Werkstudenten
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {activeWerkstudenten ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                {activeWerkstudenten === 0 ? 'Noch keine Werkstudenten aktiv' : `${activeWerkstudenten} freigeschaltete Konten`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Heute anwesend
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {todayAnwesend}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                {todayAnwesend === 0 ? 'Keine Einstempelungen heute' : `${todayAnwesend} Werkstudent${todayAnwesend !== 1 ? 'en' : ''} heute aktiv`}
              </p>
            </CardContent>
          </Card>

          <Card className={`border-slate-200 shadow-sm ${(pendingUsers ?? 0) > 0 ? 'border-amber-200 bg-amber-50' : ''}`}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Ausstehende Freischaltungen
              </CardDescription>
              <CardTitle className={`text-2xl font-bold ${(pendingUsers ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {pendingUsers ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(pendingUsers ?? 0) > 0 ? (
                <Link href="/manager/users" className="text-sm text-amber-600 hover:text-amber-700 font-medium underline underline-offset-2">
                  {pendingUsers} Konto{pendingUsers !== 1 ? 's' : ''} freischalten →
                </Link>
              ) : (
                <p className="text-sm text-slate-500">Alle Konten sind freigeschaltet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <PresenceWidget />

        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
          <p className="text-slate-500 text-sm">
            Weitere Features kommen bald — Auswertung &amp; Export (PROJ-6).
          </p>
        </div>
      </main>
    </div>
  )
}
