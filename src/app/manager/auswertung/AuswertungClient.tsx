'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuswertungDaten, type DateRange, type WerkstudentAuswertung } from './actions'
import FilterLeiste from '@/components/manager/auswertung/FilterLeiste'
import AuswertungTable from '@/components/manager/auswertung/AuswertungTable'

interface Props {
  bereiche: { id: string; name: string }[]
}

function parseRangeParam(params: URLSearchParams): DateRange {
  const range = params.get('range')
  const month = params.get('month')

  if (month) {
    const [yearStr, monthStr] = month.split('-')
    const year = parseInt(yearStr, 10)
    const m = parseInt(monthStr, 10)
    if (!isNaN(year) && !isNaN(m)) return { type: 'month', year, month: m }
  }

  if (range === 'last-month') return { type: 'last-month' }
  if (range === 'last-3-months') return { type: 'last-3-months' }
  return { type: 'current-month' }
}

export default function AuswertungClient({ bereiche }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<WerkstudentAuswertung[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentRange = parseRangeParam(searchParams)
  const currentBereich = searchParams.get('bereich') ?? 'all'

  const updateUrl = useCallback(
    (range: DateRange, bereichId: string) => {
      const params = new URLSearchParams()
      if (range.type === 'month') {
        params.set('month', `${range.year}-${String(range.month).padStart(2, '0')}`)
      } else if (range.type !== 'current-month') {
        params.set('range', range.type)
      }
      if (bereichId !== 'all') params.set('bereich', bereichId)
      router.replace(`/manager/auswertung?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  const loadData = useCallback(
    (range: DateRange, bereichId: string) => {
      startTransition(async () => {
        setError(null)
        const result = await getAuswertungDaten(range, bereichId as string | 'all')
        if (result.error) {
          setError(result.error)
          setData(null)
        } else {
          setData(result.werkstudenten)
        }
      })
    },
    []
  )

  // Load on mount and on URL change
  useEffect(() => {
    loadData(currentRange, currentBereich)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  function handleRangeChange(range: DateRange) {
    updateUrl(range, currentBereich)
  }

  function handleBereichChange(bereichId: string) {
    updateUrl(currentRange, bereichId)
  }

  function handleCorrectionDone() {
    loadData(currentRange, currentBereich)
  }

  return (
    <div className="space-y-6">
      <FilterLeiste
        bereiche={bereiche}
        currentRange={currentRange}
        currentBereich={currentBereich}
        onRangeChange={handleRangeChange}
        onBereichChange={handleBereichChange}
      />
      <AuswertungTable
        data={data}
        isLoading={isPending}
        error={error}
        onCorrectionDone={handleCorrectionDone}
      />
    </div>
  )
}
