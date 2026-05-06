import { notFound } from 'next/navigation'
import { getBereichWithDetails, getManagersForBereichSelect } from '../actions'
import BereichDetailClient from './BereichDetailClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BereichDetailPage({ params }: Props) {
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
