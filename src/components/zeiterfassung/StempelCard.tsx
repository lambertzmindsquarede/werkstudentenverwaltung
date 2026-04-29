'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { ActualEntry } from '@/lib/database.types'

interface Props {
  todayEntry: ActualEntry | null
  isWeekend: boolean
  onEntryChange: (entry: ActualEntry) => void
}

function formatTime(time: string | null): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

function calcHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = eh * 60 + em - (sh * 60 + sm)
  return diff > 0 ? diff / 60 : 0
}

export default function StempelCard({ todayEntry, isWeekend, onEntryChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isStampedIn = !!todayEntry && !todayEntry.is_complete
  const isComplete = !!todayEntry?.is_complete
  const todayHours = calcHours(todayEntry?.actual_start ?? null, todayEntry?.actual_end ?? null)

  async function handleStampIn() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/time-entries/stamp', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Einstempeln.')
      } else {
        onEntryChange(json.data as ActualEntry)
      }
    } catch {
      setError('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStampOut() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/time-entries/stamp', { method: 'PATCH' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Ausstempeln.')
      } else {
        onEntryChange(json.data as ActualEntry)
      }
    } catch {
      setError('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Zeiterfassung heute
            </CardDescription>
            <CardTitle className="text-lg text-slate-900 mt-1">
              {!todayEntry && 'Noch nicht eingestempelt'}
              {isStampedIn && `Eingestempelt seit ${formatTime(todayEntry.actual_start)} Uhr`}
              {isComplete &&
                `${formatTime(todayEntry.actual_start)} – ${formatTime(todayEntry.actual_end)} Uhr`}
            </CardTitle>
            {isComplete && todayHours > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">
                {todayHours.toFixed(1).replace('.', ',')} Stunden erfasst
              </p>
            )}
          </div>
          {isComplete && (
            <Badge className="bg-green-100 text-green-700 border border-green-300 hover:bg-green-100 flex-shrink-0 mt-1">
              Abgeschlossen
            </Badge>
          )}
          {isStampedIn && (
            <Badge className="bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-100 flex-shrink-0 mt-1">
              Läuft
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isWeekend && (
          <Alert className="mb-3 bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-700 text-sm">
              Heute ist Wochenende – Eintrag möglich, wird als Sonderarbeit markiert.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-3 border-red-300 bg-red-50">
            <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {!isComplete && (
          <Button
            onClick={isStampedIn ? handleStampOut : handleStampIn}
            disabled={loading}
            size="lg"
            className={
              isStampedIn
                ? 'bg-slate-700 hover:bg-slate-800 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
          >
            {loading ? '…' : isStampedIn ? 'Ausstempeln' : 'Einstempeln'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
