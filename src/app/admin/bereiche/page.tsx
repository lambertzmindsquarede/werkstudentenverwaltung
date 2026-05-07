import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getBereicheWithCounts } from './actions'
import BereicheClient from './BereicheClient'

export const dynamic = 'force-dynamic'

export default async function BereichePage() {
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

  const bereiche = await getBereicheWithCounts()
  return <BereicheClient initialBereiche={bereiche} />
}
