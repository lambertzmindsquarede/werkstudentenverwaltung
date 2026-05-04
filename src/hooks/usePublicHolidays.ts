'use client'

import { useState, useEffect } from 'react'
import type { Feiertag } from '@/app/api/feiertage/route'

interface UsePublicHolidaysResult {
  holidays: Feiertag[]
  loading: boolean
  isHoliday: (date: string) => boolean
  getHolidayName: (date: string) => string | null
}

const cache = new Map<string, Feiertag[]>()

async function fetchHolidays(bundesland: string, year: number): Promise<Feiertag[]> {
  const key = `${bundesland}-${year}`
  if (cache.has(key)) return cache.get(key)!

  try {
    const res = await fetch(`/api/feiertage?bundesland=${bundesland}&year=${year}`)
    const data: Feiertag[] = res.ok ? await res.json() : []
    cache.set(key, data)
    return data
  } catch {
    return []
  }
}

export function usePublicHolidays(bundesland: string, year: number): UsePublicHolidaysResult {
  const [holidays, setHolidays] = useState<Feiertag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchHolidays(bundesland, year).then((data) => {
      if (!cancelled) {
        setHolidays(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [bundesland, year])

  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]))

  return {
    holidays,
    loading,
    isHoliday: (date: string) => holidayMap.has(date),
    getHolidayName: (date: string) => holidayMap.get(date) ?? null,
  }
}

export async function fetchHolidaysForDates(
  bundesland: string,
  dates: string[]
): Promise<Map<string, string>> {
  const years = [...new Set(dates.map((d) => parseInt(d.slice(0, 4), 10)))]
  const results = await Promise.all(years.map((y) => fetchHolidays(bundesland, y)))
  const all = results.flat()
  return new Map(all.map((h) => [h.date, h.name]))
}
