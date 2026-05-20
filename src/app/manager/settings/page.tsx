import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { DEFAULT_MAX_EDIT_DAYS_PAST } from '@/lib/database.types'
import AdminNav from '@/components/admin/AdminNav'
import SettingsForm from './SettingsForm'
import AbwesenheitstypenKonfiguration from './AbwesenheitstypenKonfiguration'
import SubLocationVerwaltung from './SubLocationVerwaltung'
import TeamSichtbarkeitToggle from './TeamSichtbarkeitToggle'
import { loadManagerBereiche, loadBereichConfig } from './absence-type-override-actions'
import { getManagerArbeitsorte, getSubLocations, getTeamVisibility } from './sublocation-actions'
import IcsEinstellungen from './IcsEinstellungen'
import { loadIcsSettings } from './ics-actions'

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
  // Only show absence type configuration for bereiche with absences_enabled
  const absenceEnabledBereiche = bereiche.filter((b) => b.absences_enabled !== false)
  const initialBereichId = absenceEnabledBereiche[0]?.id ?? null
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

  const icsSettingsResult = await loadIcsSettings()
  const icsSettings = icsSettingsResult.data ?? { ics_enabled: false, additional_emails: [] }

  // Team visibility — one entry per managed bereich (BUG-20-5: support multiple bereiche)
  const bereichVisibilities = await Promise.all(
    bereiche.map(async (b) => {
      const res = await getTeamVisibility(b.id)
      return { bereichId: b.id, bereichName: b.name, visibility: (res?.data ?? 'team') as 'team' | 'global' }
    })
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav isAdmin={profile?.is_admin ?? false} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Einstellungen</h1>
          <p className="text-slate-500 mt-1 text-sm">Globale Konfiguration der Anwendung</p>
        </div>

        <SettingsForm maxEditDaysPast={maxEditDaysPast} />

        <AbwesenheitstypenKonfiguration
          bereiche={absenceEnabledBereiche}
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

        <IcsEinstellungen initialSettings={icsSettings} />
      </main>
    </div>
  )
}
