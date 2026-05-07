'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SubLocation } from '@/app/dashboard/team/actions'

interface Props {
  open: boolean
  onClose: () => void
  subLocations: SubLocation[]
  currentSubLocationId: string | null
  onSelect: (subLocationId: string | null) => Promise<{ error?: string }>
  disabled?: boolean
  disabledReason?: string
}

export default function SubOrtDialog({
  open,
  onClose,
  subLocations,
  currentSubLocationId,
  onSelect,
  disabled,
  disabledReason,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSelect(subLocationId: string | null) {
    setError(null)
    startTransition(async () => {
      const result = await onSelect(subLocationId)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Arbeitsplatz setzen</DialogTitle>
        </DialogHeader>

        {disabled ? (
          <p className="text-sm text-slate-500 py-2">{disabledReason}</p>
        ) : subLocations.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">Keine Arbeitsplätze konfiguriert</p>
        ) : (
          <div className="flex flex-col gap-2 py-2">
            {subLocations.map((sl) => (
              <Button
                key={sl.id}
                variant={currentSubLocationId === sl.id ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => handleSelect(sl.id)}
                disabled={isPending}
              >
                <Badge
                  variant={currentSubLocationId === sl.id ? 'secondary' : 'outline'}
                  className="mr-2 font-mono text-xs"
                >
                  {sl.name}
                </Badge>
                {sl.name}
              </Button>
            ))}

            {currentSubLocationId && (
              <Button
                variant="ghost"
                className="justify-start text-slate-500 mt-1"
                onClick={() => handleSelect(null)}
                disabled={isPending}
              >
                Kein Arbeitsplatz (zurücksetzen)
              </Button>
            )}
          </div>
        )}

        {error && (
          <Alert className="border-red-300 bg-red-50">
            <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  )
}
