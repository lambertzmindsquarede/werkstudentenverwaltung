import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type { DayEntry } from './actions'
import { validateBlocks } from '@/lib/time-block-utils'

// Mirrors DayEntrySchema from actions.ts
const DayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_start: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  planned_end: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  block_index: z.number().int().min(1).max(3),
})

// Mirrors normalizeTime from actions.ts
function normalizeTime(time: string): string {
  return time.substring(0, 5)
}

// Mirrors the new delete-all + insert logic from saveWeekPlan
function filterActiveBlocks(entries: DayEntry[]): DayEntry[] {
  return entries.filter((e) => e.planned_start && e.planned_end)
}

describe('DayEntrySchema', () => {
  it('accepts a valid active day with block_index', () => {
    const result = DayEntrySchema.safeParse({
      date: '2026-04-27',
      planned_start: '08:00',
      planned_end: '12:00',
      block_index: 1,
    })
    expect(result.success).toBe(true)
  })

  it('accepts block_index 2 and 3', () => {
    expect(DayEntrySchema.safeParse({ date: '2026-04-27', planned_start: '13:00', planned_end: '17:00', block_index: 2 }).success).toBe(true)
    expect(DayEntrySchema.safeParse({ date: '2026-04-27', planned_start: '18:00', planned_end: '20:00', block_index: 3 }).success).toBe(true)
  })

  it('rejects block_index 0 and 4', () => {
    expect(DayEntrySchema.safeParse({ date: '2026-04-27', planned_start: '08:00', planned_end: '12:00', block_index: 0 }).success).toBe(false)
    expect(DayEntrySchema.safeParse({ date: '2026-04-27', planned_start: '08:00', planned_end: '12:00', block_index: 4 }).success).toBe(false)
  })

  it('accepts a null-time entry (day off) — block_index still required', () => {
    const result = DayEntrySchema.safeParse({
      date: '2026-04-27',
      planned_start: null,
      planned_end: null,
      block_index: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid date format', () => {
    const result = DayEntrySchema.safeParse({
      date: '27.04.2026',
      planned_start: '08:00',
      planned_end: '12:00',
      block_index: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format (with seconds)', () => {
    const result = DayEntrySchema.safeParse({
      date: '2026-04-27',
      planned_start: '08:00:00',
      planned_end: '12:00:00',
      block_index: 1,
    })
    expect(result.success).toBe(false)
  })

  it('validates an array of entries across multiple blocks per day', () => {
    const entries: DayEntry[] = [
      { date: '2026-04-27', planned_start: '09:00', planned_end: '12:00', block_index: 1 },
      { date: '2026-04-27', planned_start: '14:00', planned_end: '17:00', block_index: 2 },
    ]
    const result = z.array(DayEntrySchema).safeParse(entries)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
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

describe('filterActiveBlocks (delete-all + insert logic)', () => {
  const weekStr = '2026-W18'
  const weekDates = getWeekDates(weekStr).map(dateToString)

  it('keeps only entries with both start and end', () => {
    const entries: DayEntry[] = [
      { date: weekDates[0], planned_start: '08:00', planned_end: '12:00', block_index: 1 },
      { date: weekDates[1], planned_start: '09:00', planned_end: '17:00', block_index: 1 },
    ]
    expect(filterActiveBlocks(entries)).toHaveLength(2)
  })

  it('filters out entries with null times', () => {
    const entries: DayEntry[] = [
      { date: weekDates[0], planned_start: '08:00', planned_end: '12:00', block_index: 1 },
      { date: weekDates[1], planned_start: null, planned_end: null, block_index: 1 },
    ]
    expect(filterActiveBlocks(entries)).toHaveLength(1)
  })

  it('handles multiple blocks per day', () => {
    const entries: DayEntry[] = [
      { date: weekDates[0], planned_start: '08:00', planned_end: '12:00', block_index: 1 },
      { date: weekDates[0], planned_start: '14:00', planned_end: '17:00', block_index: 2 },
      { date: weekDates[1], planned_start: null, planned_end: null, block_index: 1 },
    ]
    expect(filterActiveBlocks(entries)).toHaveLength(2)
  })

  it('returns empty array when no active entries', () => {
    const entries: DayEntry[] = weekDates.map((d) => ({
      date: d,
      planned_start: null,
      planned_end: null,
      block_index: 1,
    }))
    expect(filterActiveBlocks(entries)).toHaveLength(0)
  })

  it('entries with only planned_start (no end) are treated as inactive', () => {
    const entries: DayEntry[] = [
      { date: weekDates[0], planned_start: '08:00', planned_end: null, block_index: 1 },
    ]
    expect(filterActiveBlocks(entries)).toHaveLength(0)
  })
})

describe('validateBlocks (overlap detection)', () => {
  it('returns no errors for non-overlapping blocks', () => {
    const blocks = [
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '17:00' },
    ]
    expect(validateBlocks(blocks)).toHaveLength(0)
  })

  it('detects overlap between two blocks', () => {
    const blocks = [
      { start: '09:00', end: '12:00' },
      { start: '11:00', end: '14:00' },
    ]
    const errors = validateBlocks(blocks)
    expect(errors).toHaveLength(1)
    expect(errors[0].blockIndex).toBe(1)
  })

  it('detects start after end', () => {
    const blocks = [{ start: '17:00', end: '09:00' }]
    const errors = validateBlocks(blocks)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/Startzeit/)
  })

  it('detects adjacent blocks touching at boundary as non-overlapping', () => {
    const blocks = [
      { start: '09:00', end: '12:00' },
      { start: '12:00', end: '17:00' },
    ]
    expect(validateBlocks(blocks)).toHaveLength(0)
  })

  it('returns no errors for single complete block', () => {
    expect(validateBlocks([{ start: '09:00', end: '17:00' }])).toHaveLength(0)
  })
})
