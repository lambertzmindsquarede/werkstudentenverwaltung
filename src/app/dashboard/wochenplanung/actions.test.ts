import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type { DayEntry } from './actions'

// Mirrors DayEntrySchema from actions.ts
const DayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_start: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  planned_end: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
})

// Mirrors normalizeTime from actions.ts
function normalizeTime(time: string): string {
  return time.substring(0, 5)
}

// Mirrors the upsert/delete split logic from saveWeekPlan
function splitEntries(
  weekStr: string,
  entries: DayEntry[]
): { toUpsert: DayEntry[]; toDelete: string[] } {
  const weekDates = getWeekDates(weekStr).map(dateToString)
  const toUpsert = entries.filter((e) => e.planned_start && e.planned_end)
  const activeDates = new Set(toUpsert.map((e) => e.date))
  const toDelete = weekDates.filter((d) => !activeDates.has(d))
  return { toUpsert, toDelete }
}

describe('DayEntrySchema', () => {
  it('accepts a valid active day', () => {
    const result = DayEntrySchema.safeParse({
      date: '2026-04-27',
      planned_start: '08:00',
      planned_end: '12:00',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a null-time entry (day off)', () => {
    const result = DayEntrySchema.safeParse({
      date: '2026-04-27',
      planned_start: null,
      planned_end: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid date format', () => {
    const result = DayEntrySchema.safeParse({
      date: '27.04.2026',
      planned_start: '08:00',
      planned_end: '12:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format (with seconds)', () => {
    const result = DayEntrySchema.safeParse({
      date: '2026-04-27',
      planned_start: '08:00:00',
      planned_end: '12:00:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-string time', () => {
    const result = DayEntrySchema.safeParse({
      date: '2026-04-27',
      planned_start: 800,
      planned_end: '12:00',
    })
    expect(result.success).toBe(false)
  })

  it('validates an array of 5 entries', () => {
    const entries = getWeekDates('2026-W18').map((d) => ({
      date: dateToString(d),
      planned_start: '09:00',
      planned_end: '13:00',
    }))
    const result = z.array(DayEntrySchema).safeParse(entries)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(5)
  })
})

describe('normalizeTime', () => {
  it('strips seconds from HH:MM:SS', () => {
    expect(normalizeTime('08:30:00')).toBe('08:30')
  })

  it('leaves HH:MM unchanged', () => {
    expect(normalizeTime('08:30')).toBe('08:30')
  })
})

describe('splitEntries (upsert vs delete logic)', () => {
  const weekStr = '2026-W18'
  const weekDates = getWeekDates(weekStr).map(dateToString)

  it('marks active days for upsert', () => {
    const entries: DayEntry[] = [
      { date: weekDates[0], planned_start: '08:00', planned_end: '12:00' },
      { date: weekDates[1], planned_start: '09:00', planned_end: '17:00' },
    ]
    const { toUpsert } = splitEntries(weekStr, entries)
    expect(toUpsert).toHaveLength(2)
  })

  it('marks days with null times for deletion', () => {
    const entries: DayEntry[] = [
      { date: weekDates[0], planned_start: '08:00', planned_end: '12:00' },
      { date: weekDates[1], planned_start: null, planned_end: null },
    ]
    const { toDelete } = splitEntries(weekStr, entries)
    // days 1–4 (Tue–Fri) should be deleted
    expect(toDelete).toContain(weekDates[1])
    expect(toDelete).toContain(weekDates[2])
    expect(toDelete).not.toContain(weekDates[0])
  })

  it('all days deleted when no active entries', () => {
    const entries: DayEntry[] = weekDates.map((d) => ({
      date: d,
      planned_start: null,
      planned_end: null,
    }))
    const { toUpsert, toDelete } = splitEntries(weekStr, entries)
    expect(toUpsert).toHaveLength(0)
    expect(toDelete).toHaveLength(5)
  })

  it('no days deleted when all days are active', () => {
    const entries: DayEntry[] = weekDates.map((d) => ({
      date: d,
      planned_start: '08:00',
      planned_end: '16:00',
    }))
    const { toUpsert, toDelete } = splitEntries(weekStr, entries)
    expect(toUpsert).toHaveLength(5)
    expect(toDelete).toHaveLength(0)
  })

  it('entries with only planned_start (no end) are treated as inactive', () => {
    const entries: DayEntry[] = [
      { date: weekDates[0], planned_start: '08:00', planned_end: null },
    ]
    const { toUpsert, toDelete } = splitEntries(weekStr, entries)
    expect(toUpsert).toHaveLength(0)
    expect(toDelete).toContain(weekDates[0])
  })
})
