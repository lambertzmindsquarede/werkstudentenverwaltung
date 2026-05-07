import { createClient } from '@/lib/supabase-server'
import { ManagerNavProvider } from '@/contexts/ManagerNavContext'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  let showAbwesenheiten = true

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin) {
        // Admins see all bereiche — show nav if any bereich has absences enabled
        const { data: bereiche } = await supabase
          .from('bereiche')
          .select('absences_enabled')
          .eq('absences_enabled', true)
          .limit(1)
        showAbwesenheiten = (bereiche?.length ?? 0) > 0
      } else {
        // Manager: check their assigned bereiche
        const { data: assignments } = await supabase
          .from('bereich_manager')
          .select('bereich_id, bereiche(absences_enabled)')
          .eq('user_id', user.id)

        const bereiche = (assignments ?? []) as unknown as {
          bereiche: { absences_enabled: boolean } | null
        }[]

        showAbwesenheiten = bereiche.some((a) => a.bereiche?.absences_enabled !== false)
      }
    }
  } catch {
    // On error, default to showing the nav item
    showAbwesenheiten = true
  }

  return (
    <ManagerNavProvider showAbwesenheiten={showAbwesenheiten}>
      {children}
    </ManagerNavProvider>
  )
}
