import { getBereicheWithCounts } from './actions'
import BereicheClient from './BereicheClient'

export const dynamic = 'force-dynamic'

export default async function BereichePage() {
  const bereiche = await getBereicheWithCounts()
  return <BereicheClient initialBereiche={bereiche} />
}
