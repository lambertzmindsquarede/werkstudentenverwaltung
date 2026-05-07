import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getArbeitsorte } from './actions'
import ArbeitsortVerwaltungClient from '@/components/arbeitsorte/ArbeitsortVerwaltungClient'

export default async function ArbeitsorteVerwaltungPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager' && !profile?.is_admin) redirect('/dashboard')

  const { data: arbeitsorte, error } = await getArbeitsorte()

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-red-600 text-sm">Fehler: {error}</p>
      </div>
    )
  }

  return <ArbeitsortVerwaltungClient initialArbeitsorte={arbeitsorte ?? []} isAdmin={profile?.is_admin ?? false} />
}
