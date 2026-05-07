'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface MonthSummary {
  year: number
  month: number
  monthLabel: string
  rangeLabel: string
  daysWithData: number
  totalHours: number
  hasData: boolean
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDefaultFrom(): string {
  const now = new Date()
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth() - 1, 20))
}

function getDefaultTo(): string {
  const now = new Date()
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 19))
}

interface Props {
  userId?: string
  disabled?: boolean
  disabledReason?: string
}

export default function StundenzettelExportButton({ userId, disabled, disabledReason }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [from, setFrom] = useState(getDefaultFrom)
  const [to, setTo] = useState(getDefaultTo)
  const [months, setMonths] = useState<MonthSummary[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  function handleOpen() {
    setStep(1)
    setFrom(getDefaultFrom())
    setTo(getDefaultTo())
    setMonths([])
    setOpen(true)
  }

  async function handlePreview() {
    if (!from || !to || from > to) {
      toast.error('Bitte gültige Datumsangaben eingeben.')
      return
    }
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/export/stundenzettel/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, from, to }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Fehler beim Laden der Vorschau.')
        return
      }
      setMonths(json.months)
      setStep(2)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/export/stundenzettel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, from, to }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'Fehler beim Exportieren.')
        return
      }
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition') ?? ''
      const match = contentDisposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'stundenzettel.xlsx'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Stundenzettel heruntergeladen.')
      setOpen(false)
    } finally {
      setDownloading(false)
    }
  }

  const hasAnyData = months.some((m) => m.hasData)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className="gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Stundenzettel exportieren
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Stundenzettel exportieren</DialogTitle>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-5 py-2">
              <p className="text-sm text-slate-500">
                Wähle den Zeitraum für den Export. Pro Kalendermonat wird eine Excel-Datei
                erzeugt.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from-date">Von</Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to-date">Bis</Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Standard: 20. des Vormonats – 19. des aktuellen Monats
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-500">
                Folgende Dateien werden erzeugt:
              </p>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Monat</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Zeitraum</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Tage</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Stunden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={`${m.year}-${m.month}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-800">{m.monthLabel}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{m.rangeLabel}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{m.daysWithData}</td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {m.hasData ? `${m.totalHours} h` : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!hasAnyData && (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Keine Zeiterfassungsdaten für diesen Zeitraum. Die Excel-Dateien werden leer exportiert.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {step === 1 && (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handlePreview} disabled={previewLoading}>
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Weiter
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Zurück
                </Button>
                <Button onClick={handleDownload} disabled={downloading} className="gap-2">
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Herunterladen
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
