'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, AlertCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { minutesToHHMM } from './utils'
import type { WerkstudentAuswertung } from '@/app/manager/auswertung/actions'
import TagDetailZeile from './TagDetailZeile'
import ZeiteintragHinzufuegenDialog from './ZeiteintragHinzufuegenDialog'

interface Props {
  ws: WerkstudentAuswertung
  onCorrectionDone: () => void
}

function formatHours(minutes: number): string {
  return `${minutesToHHMM(minutes)} h`
}

function formatDiff(minutes: number): React.ReactNode {
  const sign = minutes >= 0 ? '+' : '−'
  const formatted = `${sign}${minutesToHHMM(Math.abs(minutes))} h`
  return (
    <span className={`font-medium ${minutes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
      {formatted}
    </span>
  )
}

function AuslastungBadge({ pct, over }: { pct: number | null; over: boolean }) {
  if (pct === null) return <span className="text-slate-400 text-sm">—</span>

  let color = 'bg-emerald-100 text-emerald-700'
  if (over || pct > 100) color = 'bg-red-100 text-red-700'
  else if (pct < 70) color = 'bg-amber-100 text-amber-700'

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {pct}%
    </span>
  )
}

export default function WerkstudentZeile({ ws, onCorrectionDone }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const hasData = ws.geplanteMinutes > 0 || ws.istMinutes > 0
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <tr
        className={`border-b border-slate-200 cursor-pointer transition-colors ${
          expanded ? 'bg-blue-50/50' : 'hover:bg-slate-50'
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="pl-4 pr-3 py-3 text-sm">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            }
            <span className="font-medium text-slate-900">{ws.fullName}</span>
            {ws.limitUeberschritten && (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-label="Wochenstundenlimit überschritten" />
            )}
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-right text-slate-700 tabular-nums">
          {hasData ? formatHours(ws.geplanteMinutes) : <span className="text-slate-400">—</span>}
        </td>
        <td className="px-3 py-3 text-sm text-right text-slate-700 tabular-nums">
          {hasData ? formatHours(ws.istMinutes) : <span className="text-slate-400">—</span>}
        </td>
        <td className={`px-3 py-3 text-sm text-right tabular-nums ${ws.limitUeberschritten ? 'text-red-600' : ''}`}>
          {hasData ? formatDiff(ws.diffMinutes) : <span className="text-slate-400">—</span>}
        </td>
        <td className="px-3 py-3 text-sm text-right pr-6">
          <AuslastungBadge pct={ws.auslastungProzent} over={ws.limitUeberschritten} />
        </td>
      </tr>
      {expanded && ws.tage.length > 0 && (
        <tr>
          <td colSpan={5} className="p-0">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100/80">
                  <th className="pl-10 pr-3 py-1.5 text-xs font-medium text-slate-500 text-left">Tag</th>
                  <th className="px-3 py-1.5 text-xs font-medium text-slate-500 text-left">Plan</th>
                  <th className="px-3 py-1.5 text-xs font-medium text-slate-500 text-left">Ist</th>
                  <th className="px-3 py-1.5 text-xs font-medium text-slate-500 text-left">Netto</th>
                  <th className="px-3 py-1.5 text-xs font-medium text-slate-500 text-left">Diff.</th>
                  <th className="px-3 py-1.5 text-xs font-medium text-slate-500 text-left w-8"></th>
                </tr>
              </thead>
              <tbody>
                {ws.tage.map((tag) => (
                  <TagDetailZeile
                    key={tag.date}
                    tag={tag}
                    userId={ws.userId}
                    onCorrectionDone={onCorrectionDone}
                  />
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
      {expanded && ws.tage.length === 0 && (
        <tr className="border-b border-slate-100">
          <td colSpan={5} className="pl-10 py-3 text-sm text-slate-500 italic">
            Keine Einträge im gewählten Zeitraum.
          </td>
        </tr>
      )}
      {expanded && (
        <tr className="border-b border-slate-200 bg-slate-50/40">
          <td colSpan={5} className="pl-10 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-400 hover:text-slate-700 px-2 gap-1.5"
              onClick={(e) => { e.stopPropagation(); setShowAddDialog(true) }}
            >
              <Plus className="w-3.5 h-3.5" />
              Tag nachträglich eintragen
            </Button>
          </td>
        </tr>
      )}

      <ZeiteintragHinzufuegenDialog
        open={showAddDialog}
        date={today}
        userId={ws.userId}
        onClose={() => setShowAddDialog(false)}
        onSaved={() => { setShowAddDialog(false); onCorrectionDone() }}
      />
    </>
  )
}
