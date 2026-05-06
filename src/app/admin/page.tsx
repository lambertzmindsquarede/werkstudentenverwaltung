import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createAdminClient } from '@/lib/supabase-admin'
import { ManagerSignOutButton } from '@/components/ManagerSignOutButton'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const admin = createAdminClient()

  const [
    { count: bereicheCount },
    { count: werkstudentCount },
    { count: managerCount },
  ] = await Promise.all([
    admin.from('bereiche').select('*', { count: 'exact', head: true }),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'werkstudent')
      .eq('is_active', true),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'manager')
      .eq('is_active', true),
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2.5 py-1 rounded-full">
            Admin
          </span>
          <ManagerSignOutButton />
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          <Link
            href="/admin"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-purple-600"
          >
            Übersicht
          </Link>
          <Link
            href="/admin/bereiche"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Bereiche
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Admin-Übersicht</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Organisationsstruktur und Bereichsverwaltung
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Bereiche
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {bereicheCount ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href="/admin/bereiche"
                className="text-sm text-purple-600 hover:text-purple-700 font-medium underline underline-offset-2"
              >
                Bereiche verwalten →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Aktive Manager
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {managerCount ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                {managerCount === 0
                  ? 'Keine Manager aktiv'
                  : `${managerCount} aktive Manager`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Aktive Werkstudenten
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {werkstudentCount ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                {werkstudentCount === 0
                  ? 'Keine Werkstudenten aktiv'
                  : `${werkstudentCount} aktive Werkstudenten`}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 bg-purple-50 border border-purple-100 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-purple-900 mb-2">Admin-Bereich</h2>
          <p className="text-sm text-slate-600">
            Hier verwaltest du die Organisationsstruktur der App: Erstelle Bereiche, weise Manager
            zu und stelle sicher, dass alle Werkstudenten korrekt zugeordnet sind.
          </p>
        </div>
      </main>
    </div>
  )
}
