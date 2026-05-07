import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import UsersClient from '@/app/manager/users/UsersClient'
import { getUsersForManager } from '@/app/manager/users/actions'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ bereich?: string }>
}

export default async function AdminUsersPage({ searchParams }: Props) {
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

  const params = await searchParams
  const bereichFilter = params.bereich ?? null
  const result = await getUsersForManager(bereichFilter)

  if ('error' in result) {
    return (
      <UsersClient
        initialUsers={[]}
        managers={[]}
        isAdmin={profile?.is_admin ?? false}
        bereiche={[]}
        selectedBereich={null}
        navType="admin"
      />
    )
  }

  return (
    <UsersClient
      initialUsers={result.users}
      managers={result.managers}
      isAdmin={result.isAdmin}
      bereiche={result.bereiche}
      selectedBereich={bereichFilter}
      navType="admin"
    />
  )
}
