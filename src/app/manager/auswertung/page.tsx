import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import ManagerNav from '@/components/manager/ManagerNav'
import AuswertungClient from './AuswertungClient'

export const dynamic = 'force-dynamic'

export default async function AuswertungPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && !profile.is_admin)) {
    redirect('/dashboard')
  }

  let bereiche: { id: string; name: string }[] = []
  if (profile.is_admin) {
    const { data } = await admin.from('bereiche').select('id, name').order('name')
    bereiche = data ?? []
  } else {
    const { data: assignments } = await admin
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    if (assignments?.length) {
      const ids = assignments.map((a) => a.bereich_id)
      const { data } = await admin.from('bereiche').select('id, name').in('id', ids).order('name')
      bereiche = data ?? []
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ManagerNav isAdmin={profile.is_admin} />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Auswertung</h1>
          <p className="text-slate-500 mt-1 text-sm">Plan-vs-Ist-Vergleich für deine Werkstudenten</p>
        </div>
        <AuswertungClient bereiche={bereiche} />
      </main>
    </div>
  )
}
