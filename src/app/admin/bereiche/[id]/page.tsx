import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getBereichWithDetails, getManagersForBereichSelect } from '../actions'
import BereichDetailClient from './BereichDetailClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BereichDetailPage({ params }: Props) {
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

  const { id } = await params
  const [{ bereich, managers, werkstudenten }, availableManagers] = await Promise.all([
    getBereichWithDetails(id),
    getManagersForBereichSelect(),
  ])

  if (!bereich) notFound()

  return (
    <BereichDetailClient
      bereich={bereich}
      managers={managers}
      werkstudenten={werkstudenten}
      availableManagers={availableManagers}
    />
  )
}
