import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AdminNav from '@/components/admin/AdminNav'
import { loadGlobalAbsenceTypes, loadBereichOverrideStatus } from './actions'
import AbwesenheitstypenClient from './AbwesenheitstypenClient'

export const dynamic = 'force-dynamic'

export default async function AdminAbwesenheitstypenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/admin/users')

  const [{ data: types, usingDefaults }, { data: bereichStatus }] = await Promise.all([
    loadGlobalAbsenceTypes(),
    loadBereichOverrideStatus(),
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav isAdmin={true} />

      <AbwesenheitstypenClient
        initialTypes={types}
        usingDefaults={usingDefaults ?? false}
        bereichStatus={bereichStatus ?? []}
      />
    </div>
  )
}
