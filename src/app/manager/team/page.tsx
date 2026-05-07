import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getManagerBereiche, getTeamPresenceForBereich } from './actions'
import ManagerTeamClient from './ManagerTeamClient'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ bereich?: string }>
}

export default async function ManagerTeamPage({ searchParams }: Props) {
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

  const [bereiche, params] = await Promise.all([getManagerBereiche(), searchParams])

  if (bereiche.length === 0) {
    return (
      <ManagerTeamClient
        today={new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())}
        bereiche={[]}
        selectedBereichId=""
        initialData={{ me: null, teams: [] }}
        isAdmin={profile?.is_admin ?? false}
      />
    )
  }

  const selectedBereichId = params.bereich && bereiche.some((b) => b.id === params.bereich)
    ? params.bereich
    : bereiche[0].id

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const presenceResult = await getTeamPresenceForBereich(selectedBereichId, today)

  return (
    <ManagerTeamClient
      today={today}
      bereiche={bereiche}
      selectedBereichId={selectedBereichId}
      initialData={presenceResult.data ?? { me: null, teams: [] }}
      isAdmin={profile?.is_admin ?? false}
    />
  )
}
