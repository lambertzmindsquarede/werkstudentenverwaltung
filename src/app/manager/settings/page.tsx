import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { ManagerSignOutButton } from '@/components/ManagerSignOutButton'
import { DEFAULT_MAX_EDIT_DAYS_PAST } from '@/lib/database.types'
import SettingsForm from './SettingsForm'
import AbwesenheitstypenKonfiguration from './AbwesenheitstypenKonfiguration'
import SubLocationVerwaltung from './SubLocationVerwaltung'
import TeamSichtbarkeitToggle from './TeamSichtbarkeitToggle'
import { loadManagerBereiche, loadBereichConfig } from './absence-type-override-actions'
import { getManagerArbeitsorte, getSubLocations, getTeamVisibility } from './sublocation-actions'

export const dynamic = 'force-dynamic'

export default async function ManagerSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager' && !profile?.is_admin) redirect('/dashboard')

  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'max_edit_days_past')
    .single()

  const maxEditDaysPast = setting ? parseInt(setting.value, 10) : DEFAULT_MAX_EDIT_DAYS_PAST

  const bereiche = await loadManagerBereiche()
  const initialBereichId = bereiche[0]?.id ?? null
  const initialConfigResult = initialBereichId
    ? await loadBereichConfig(initialBereichId)
    : null
  const initialConfig = initialConfigResult?.data ?? null

  // Sub-location management data
  const { data: arbeitsorte } = await getManagerArbeitsorte()
  const initialSubLocations: Record<string, import('./sublocation-actions').SubLocation[]> = {}
  if (arbeitsorte) {
    await Promise.all(
      arbeitsorte.map(async (a) => {
        const res = await getSubLocations(a.id)
        if (res.data) initialSubLocations[a.id] = res.data
      })
    )
  }

  // Team visibility — one entry per managed bereich (BUG-20-5: support multiple bereiche)
  const bereichVisibilities = await Promise.all(
    bereiche.map(async (b) => {
      const res = await getTeamVisibility(b.id)
      return { bereichId: b.id, bereichName: b.name, visibility: (res?.data ?? 'team') as 'team' | 'global' }
    })
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2.5 py-1 rounded-full">
            Manager
          </span>
          <ManagerSignOutButton />
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          <Link
            href="/manager"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Übersicht
          </Link>
          <Link
            href="/manager/users"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Nutzerverwaltung
          </Link>
          <Link
            href="/manager/kalender"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Kalenderansicht
          </Link>
          <Link
            href="/manager/settings"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600"
          >
            Einstellungen
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Einstellungen</h1>
          <p className="text-slate-500 mt-1 text-sm">Globale Konfiguration der Anwendung</p>
        </div>

        <SettingsForm maxEditDaysPast={maxEditDaysPast} />

        <AbwesenheitstypenKonfiguration
          bereiche={bereiche}
          initialBereichId={initialBereichId}
          initialConfig={initialConfig}
        />

        <SubLocationVerwaltung
          arbeitsorte={arbeitsorte ?? []}
          initialSubLocations={initialSubLocations}
        />

        {bereichVisibilities.map(({ bereichId, bereichName, visibility }) => (
          <TeamSichtbarkeitToggle
            key={bereichId}
            bereichId={bereichId}
            bereichName={bereichName}
            initialVisibility={visibility}
          />
        ))}
      </main>
    </div>
  )
}
