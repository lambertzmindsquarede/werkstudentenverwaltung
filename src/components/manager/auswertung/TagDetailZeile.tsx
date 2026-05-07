'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { minutesToHHMM } from './utils'
import type { TagDetail, IstEintragDetail } from '@/app/manager/auswertung/actions'
import ZeitkorrektureDialog from './ZeitkorrektureDialog'
import ZeiteintragHinzufuegenDialog from './ZeiteintragHinzufuegenDialog'
import ZeiteintragLoeschenDialog from './ZeiteintragLoeschenDialog'

interface Props {
  tag: TagDetail
  userId: string
  onCorrectionDone: () => void
}

function formatTime(t: string | null): string {
  if (!t) return '—'
  return t.substring(0, 5)
}

function formatDiff(minutes: number | null): React.ReactNode {
  if (minutes === null) return <span className="text-slate-400">—</span>
  const sign = minutes >= 0 ? '+' : '−'
  const abs = Math.abs(minutes)
  const formatted = `${sign}${minutesToHHMM(abs)} h`
  return (
    <span className={minutes >= 0 ? 'text-emerald-600' : 'text-red-600'}>
      {formatted}
    </span>
  )
}

export default function TagDetailZeile({ tag, userId, onCorrectionDone }: Props) {
  const [editEntry, setEditEntry] = useState<IstEintragDetail | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<IstEintragDetail | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const dateObj = new Date(tag.date + 'T00:00:00')
  const dayFormatted =
    String(dateObj.getDate()).padStart(2, '0') + '.' + String(dateObj.getMonth() + 1).padStart(2, '0') + '.'

  function handleCorrectionDone() {
    setEditEntry(null)
    setDeleteEntry(null)
    setShowAddDialog(false)
    onCorrectionDone()
  }

  // A placeholder entry for when dialogs are open but editEntry/deleteEntry might be null
  const dialogEditEntry = editEntry ?? tag.istEintraege[0]
  const dialogDeleteEntry = deleteEntry ?? tag.istEintraege[0]

  return (
    <>
      {/* Summary row */}
      <tr className="border-b border-slate-100 last:border-0 bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
        <td className="pl-10 pr-3 py-2 text-sm text-slate-600 whitespace-nowrap">
          <span className="font-medium text-slate-700">{tag.weekday}</span>
          <span className="text-slate-500 ml-1">{dayFormatted}</span>
        </td>
        <td className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap">
          {tag.planStart && tag.planEnd
            ? `${formatTime(tag.planStart)}–${formatTime(tag.planEnd)}`
            : <span className="text-slate-400">—</span>
          }
        </td>
        <td className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap">
          {tag.istStart && tag.istEnd
            ? `${formatTime(tag.istStart)}–${formatTime(tag.istEnd)}`
            : <span className="text-slate-400">—</span>
          }
          {tag.istEintraege.length > 1 && (
            <span className="text-slate-400 ml-1 text-xs">({tag.istEintraege.length} Bl.)</span>
          )}
        </td>
        <td className="px-3 py-2 text-sm text-slate-700 whitespace-nowrap">
          {tag.nettoMinutes > 0
            ? `${minutesToHHMM(tag.nettoMinutes)} h`
            : <span className="text-slate-400">—</span>
          }
        </td>
        <td className="px-3 py-2 text-sm whitespace-nowrap">
          {tag.isUngeplant ? (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs font-medium">
              Ungeplant
            </Badge>
          ) : (
            formatDiff(tag.diffMinutes)
          )}
        </td>
        <td className="px-3 py-2 text-sm whitespace-nowrap w-8"></td>
      </tr>

      {/* Per-entry sub-rows */}
      {tag.istEintraege.map((entry, i) => {
        const isApproved = entry.status === 'approved'
        const isCorrected = !!entry.corrected_by
        return (
          <tr key={entry.id} className="bg-white border-b border-slate-50">
            <td className="pl-14 pr-3 py-1.5 text-xs text-slate-400 whitespace-nowrap">
              Block {i + 1}
            </td>
            <td className="px-3 py-1.5 text-xs text-slate-500 whitespace-nowrap" colSpan={3}>
              {formatTime(entry.actual_start)} – {formatTime(entry.actual_end)} Uhr
              {isCorrected && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-help">
                        Bearbeitet
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">{entry.correction_note ?? 'Vom Manager korrigiert'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {isApproved && (
                <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border border-green-200 hover:bg-green-100">
                  Genehmigt
                </Badge>
              )}
            </td>
            <td className="px-3 py-1.5 text-xs whitespace-nowrap" colSpan={2}>
              <div className="flex items-center gap-0.5 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 ${
                    isApproved
                      ? 'opacity-30 cursor-not-allowed text-slate-400'
                      : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                  disabled={isApproved}
                  onClick={() => !isApproved && setEditEntry(entry)}
                  title={isApproved ? 'Genehmigte Einträge können nicht bearbeitet werden' : 'Eintrag bearbeiten'}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 ${
                    isApproved
                      ? 'opacity-30 cursor-not-allowed text-slate-400'
                      : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                  }`}
                  disabled={isApproved}
                  onClick={() => !isApproved && setDeleteEntry(entry)}
                  title={isApproved ? 'Genehmigte Einträge können nicht gelöscht werden' : 'Eintrag löschen'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </td>
          </tr>
        )
      })}

      {/* Add entry row */}
      <tr className="bg-white border-b border-slate-100">
        <td colSpan={6} className="pl-14 py-1 pb-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-slate-400 hover:text-slate-600 px-1 gap-1"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-3 h-3" />
            Eintrag hinzufügen
          </Button>
        </td>
      </tr>

      {/* Dialogs — Radix Portal renders to document.body regardless of DOM position */}
      {dialogEditEntry && (
        <ZeitkorrektureDialog
          open={!!editEntry}
          date={tag.date}
          userId={userId}
          entry={dialogEditEntry}
          onClose={() => setEditEntry(null)}
          onSaved={handleCorrectionDone}
        />
      )}

      {dialogDeleteEntry && (
        <ZeiteintragLoeschenDialog
          open={!!deleteEntry}
          date={tag.date}
          userId={userId}
          entry={dialogDeleteEntry}
          onClose={() => setDeleteEntry(null)}
          onDeleted={handleCorrectionDone}
        />
      )}

      <ZeiteintragHinzufuegenDialog
        open={showAddDialog}
        date={tag.date}
        userId={userId}
        onClose={() => setShowAddDialog(false)}
        onSaved={handleCorrectionDone}
      />
    </>
  )
}
