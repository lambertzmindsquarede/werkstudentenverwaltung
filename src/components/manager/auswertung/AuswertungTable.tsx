'use client'

import { Skeleton } from '@/components/ui/skeleton'
import type { WerkstudentAuswertung } from '@/app/manager/auswertung/actions'
import WerkstudentZeile from './WerkstudentZeile'

interface Props {
  data: WerkstudentAuswertung[] | null
  isLoading: boolean
  error: string | null
  onCorrectionDone: () => void
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  )
}

export default function AuswertungTable({ data, isLoading, error, onCorrectionDone }: Props) {
  if (isLoading) return <TableSkeleton />

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        Fehler beim Laden: {error}
      </div>
    )
  }

  if (data === null) return <TableSkeleton />

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
        Keine Werkstudenten in diesem Bereich gefunden.
      </div>
    )
  }

  const allEmpty = data.every((ws) => ws.geplanteMinutes === 0 && ws.istMinutes === 0)

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
      {allEmpty && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-sm text-amber-700">
          Keine Zeiterfassungsdaten für diesen Zeitraum.
        </div>
      )}
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="pl-4 pr-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Werkstudent
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Geplant
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Ist
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Diff.
            </th>
            <th className="px-3 py-3 text-right pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Auslastung
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((ws) => (
            <WerkstudentZeile key={ws.userId} ws={ws} onCorrectionDone={onCorrectionDone} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
