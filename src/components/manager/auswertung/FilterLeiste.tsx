'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DateRange } from '@/app/manager/auswertung/actions'

interface Props {
  bereiche: { id: string; name: string }[]
  currentRange: DateRange
  currentBereich: string
  onRangeChange: (range: DateRange) => void
  onBereichChange: (bereichId: string) => void
}

const QUICK_RANGES: { label: string; range: DateRange }[] = [
  { label: 'Aktueller Monat', range: { type: 'current-month' } },
  { label: 'Letzter Monat', range: { type: 'last-month' } },
  { label: 'Letzte 3 Monate', range: { type: 'last-3-months' } },
]

function isQuickRange(range: DateRange): 'current-month' | 'last-month' | 'last-3-months' | null {
  if (range.type !== 'month') return range.type
  return null
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function buildYears(): number[] {
  const current = new Date().getFullYear()
  return [current, current - 1, current - 2]
}

export default function FilterLeiste({
  bereiche,
  currentRange,
  currentBereich,
  onRangeChange,
  onBereichChange,
}: Props) {
  const activeQuick = isQuickRange(currentRange)
  const pickerMonth = currentRange.type === 'month' ? currentRange.month : new Date().getMonth() + 1
  const pickerYear = currentRange.type === 'month' ? currentRange.year : new Date().getFullYear()

  function handleMonthChange(value: string) {
    onRangeChange({ type: 'month', year: pickerYear, month: parseInt(value, 10) })
  }

  function handleYearChange(value: string) {
    onRangeChange({ type: 'month', year: parseInt(value, 10), month: pickerMonth })
  }

  const years = buildYears()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        {QUICK_RANGES.map(({ label, range }) => (
          <Button
            key={range.type}
            variant={activeQuick === range.type ? 'default' : 'outline'}
            size="sm"
            onClick={() => onRangeChange(range)}
            className={
              activeQuick === range.type
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'text-slate-600 border-slate-300 hover:bg-slate-100'
            }
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Select value={String(pickerMonth)} onValueChange={handleMonthChange}>
          <SelectTrigger
            className={`w-36 text-sm ${currentRange.type === 'month' ? 'border-blue-400 ring-1 ring-blue-300' : 'border-slate-300'}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(pickerYear)} onValueChange={handleYearChange}>
          <SelectTrigger
            className={`w-24 text-sm ${currentRange.type === 'month' ? 'border-blue-400 ring-1 ring-blue-300' : 'border-slate-300'}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {bereiche.length > 1 && (
        <div className="ml-auto">
          <Select value={currentBereich} onValueChange={onBereichChange}>
            <SelectTrigger className="w-48 text-sm border-slate-300">
              <SelectValue placeholder="Bereich wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Bereiche</SelectItem>
              {bereiche.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
