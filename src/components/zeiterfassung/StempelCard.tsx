'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import IstEintragEditDialog from './IstEintragEditDialog'
import type { ActualEntry } from '@/lib/database.types'
import { calcBlockHours } from '@/lib/time-block-utils'

interface Props {
  todayEntries: ActualEntry[]
  isWeekend: boolean
  onEntryChange: (entry: ActualEntry) => void
  onEntryDeleted: (entryId: string) => void
}

function formatTime(time: string | null): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

function formatHours(h: number): string {
  return h.toFixed(1).replace('.', ',') + ' Std'
}

export default function StempelCard({
  todayEntries,
  isWeekend,
  onEntryChange,
  onEntryDeleted,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<ActualEntry | null>(null)

  const completedBlocks = todayEntries.filter((e) => e.is_complete)
  const openBlock = todayEntries.find((e) => !e.is_complete) ?? null
  const atMaxBlocks = completedBlocks.length >= 3 && !openBlock
  const canStampIn = !openBlock && completedBlocks.length < 3

  const todayTotalHours = completedBlocks.reduce(
    (sum, e) => sum + calcBlockHours(e.actual_start, e.actual_end),
    0
  )

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
    <>
      <Card className="border-slate-200 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Zeiterfassung heute
          </CardDescription>
          <CardTitle className="text-lg text-slate-900 mt-1">
            {todayEntries.length === 0 && 'Noch nicht eingestempelt'}
            {openBlock && `Eingestempelt seit ${formatTime(openBlock.actual_start)} Uhr`}
            {!openBlock && completedBlocks.length > 0 && (
              <span className="flex items-center gap-2">
                {completedBlocks.length === 1
                  ? `${formatTime(completedBlocks[0].actual_start)} – ${formatTime(completedBlocks[0].actual_end)} Uhr`
                  : `${completedBlocks.length} Blöcke heute`}
                <Badge className="bg-green-100 text-green-700 border border-green-300 hover:bg-green-100 text-sm font-normal">
                  {formatHours(todayTotalHours)}
                </Badge>
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {isWeekend && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-700 text-sm">
                Heute ist Wochenende – Eintrag möglich, wird als Sonderarbeit markiert.
              </AlertDescription>
            </Alert>
          )}

          {/* Completed blocks list */}
          {completedBlocks.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {completedBlocks.map((block) => {
                const blockHours = calcBlockHours(block.actual_start, block.actual_end)
                return (
                  <div
                    key={block.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-sm text-slate-700">
                      {formatTime(block.actual_start)} – {formatTime(block.actual_end)} Uhr
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-slate-500">
                        {formatHours(blockHours)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-400 hover:text-slate-700 px-2"
                        onClick={() => setEditEntry(block)}
                      >
                        Bearbeiten
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Open block indicator */}
          {openBlock && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm text-blue-700">
                Läuft seit {formatTime(openBlock.actual_start)} Uhr
              </span>
              <Badge className="bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-100">
                Aktiv
              </Badge>
            </div>
          )}

          {error && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* Stamp button */}
          {atMaxBlocks ? (
            <div>
              <Button disabled size="lg" className="bg-slate-200 text-slate-400 cursor-not-allowed">
                Einstempeln
              </Button>
              <p className="text-xs text-slate-400 mt-1.5">
                Maximum 3 Blöcke pro Tag erreicht.
              </p>
            </div>
          ) : openBlock ? (
            <Button
              onClick={handleStampOut}
              disabled={loading}
              size="lg"
              className="bg-slate-700 hover:bg-slate-800 text-white"
            >
              {loading ? '…' : 'Ausstempeln'}
            </Button>
          ) : canStampIn ? (
            <Button
              onClick={handleStampIn}
              disabled={loading}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? '…' : 'Einstempeln'}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {editEntry && (
        <IstEintragEditDialog
          open
          date={editEntry.date}
          entry={editEntry}
          otherEntries={todayEntries.filter((e) => e.id !== editEntry.id)}
          onClose={() => setEditEntry(null)}
          onSaved={(updated) => {
            onEntryChange(updated)
            setEditEntry(null)
          }}
          onDeleted={(id) => {
            onEntryDeleted(id)
            setEditEntry(null)
          }}
        />
      )}
    </>
  )
}
