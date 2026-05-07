export const dynamic = 'force-dynamic'

import UsersClient from './UsersClient'
import { getUsersForManager } from './actions'

interface Props {
  searchParams: Promise<{ bereich?: string }>
}

export default async function UsersPage({ searchParams }: Props) {
  const params = await searchParams
  const bereichFilter = params.bereich ?? null
  const result = await getUsersForManager(bereichFilter)

  if ('error' in result) {
    return (
      <UsersClient
        initialUsers={[]}
        managers={[]}
        isAdmin={false}
        bereiche={[]}
        selectedBereich={null}
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
    />
  )
}
