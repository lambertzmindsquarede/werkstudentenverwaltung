'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function PersonalnummerBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
      <p className="text-sm text-yellow-800">
        Deine <span className="font-medium">Personalnummer</span> fehlt noch – sie wird für den
        Stundenzettel-Export benötigt.
      </p>
      <Button asChild variant="outline" size="sm" className="ml-auto shrink-0 border-yellow-300 bg-white text-yellow-800 hover:bg-yellow-100">
        <Link href="/dashboard/profile">Jetzt eintragen</Link>
      </Button>
    </div>
  )
}
