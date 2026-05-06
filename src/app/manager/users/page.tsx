export const dynamic = 'force-dynamic'

import UsersClient from './UsersClient'
import { getBereicheForAssignment } from '@/app/admin/bereiche/actions'
import type { Bereich } from '@/lib/database.types'

export default async function UsersPage() {
  let bereiche: Bereich[] = []
  try {
    bereiche = await getBereicheForAssignment()
  } catch {
    bereiche = []
  }
  return <UsersClient bereiche={bereiche} />
}
