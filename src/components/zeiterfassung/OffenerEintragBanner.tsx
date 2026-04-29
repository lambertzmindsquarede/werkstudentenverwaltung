'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ActualEntry } from '@/lib/database.types'

interface Props {
  entry: ActualEntry
  onEditClick: () => void
}

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

export default function OffenerEintragBanner({ entry, onEditClick }: Props) {
  return (
    <Alert className="mb-5 bg-amber-50 border-amber-300">
      <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
        <span className="text-sm text-amber-800">
          Eintrag vom {formatDateDE(entry.date)} ist unvollständig – Endzeit fehlt noch.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onEditClick}
          className="border-amber-400 text-amber-700 hover:bg-amber-100 flex-shrink-0"
        >
          Endzeit nachtragen →
        </Button>
      </AlertDescription>
    </Alert>
  )
}
