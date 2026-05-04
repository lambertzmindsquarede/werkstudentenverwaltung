import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type { DayEntry } from './actions'
import { validateBlocks } from '@/lib/time-block-utils'

// Mirrors the legacy DayEntrySchema (pre-PROJ-13, no quarter-hour refinement)
const DayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_start: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  planned_end: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  block_index: z.number().int().min(1).max(3),
})

// PROJ-13: Mirrors QuarterHourTime Zod refinement from actions.ts
const QUARTER_MINUTES = new Set([0, 15, 30, 45])
const QuarterHourTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .refine((t) => QUARTER_MINUTES.has(parseInt(t.split(':')[1], 10)), {
    message: 'Zeiten müssen auf Viertelstunden fallen (0, 15, 30 oder 45 Minuten)',
  })

// PROJ-13: Mirrors DayEntrySchema with QuarterHourTime from actions.ts
const DayEntrySchemaV13 = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_start: QuarterHourTime.nullable(),
  planned_end: QuarterHourTime.nullable(),
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

// PROJ-12: Past-date guard — mirrors logic in saveWeekPlan
function getEditableDates(weekDates: string[], todayStr: string): string[] {
  return weekDates.filter((d) => d >= todayStr)
}

function filterInsertable(entries: DayEntry[], todayStr: string): DayEntry[] {
  return entries.filter((e) => e.planned_start && e.planned_end && e.date >= todayStr)
}

describe('PROJ-12: Past-date filtering in saveWeekPlan server guard', () => {
  const PAST_WEEK = ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01']
  const FUTURE_WEEK = ['2030-05-06', '2030-05-07', '2030-05-08', '2030-05-09', '2030-05-10']

  it('today is included in editable dates (>= boundary)', () => {
    const today = '2026-04-27'
    expect(getEditableDates(PAST_WEEK, today)).toContain('2026-04-27')
  })

  it('yesterday is excluded from editable dates', () => {
    const today = '2026-04-28'
    expect(getEditableDates(PAST_WEEK, today)).not.toContain('2026-04-27')
  })

  it('fully past week returns empty array — triggers early return in saveWeekPlan', () => {
    const today = '2026-05-02'
    expect(getEditableDates(PAST_WEEK, today)).toHaveLength(0)
  })

  it('fully future week returns all 5 dates as editable', () => {
    const today = '2026-05-02'
    expect(getEditableDates(FUTURE_WEEK, today)).toHaveLength(5)
  })

  it('mid-week: only today and future dates are editable', () => {
    const today = '2026-04-29'
    const editable = getEditableDates(PAST_WEEK, today)
    expect(editable).toEqual(['2026-04-29', '2026-04-30', '2026-05-01'])
  })

  it('filterInsertable excludes past-dated entries', () => {
    const today = '2026-04-29'
    const entries: DayEntry[] = [
      { date: '2026-04-27', planned_start: '09:00', planned_end: '17:00', block_index: 1 },
      { date: '2026-04-28', planned_start: '09:00', planned_end: '17:00', block_index: 1 },
      { date: '2026-04-29', planned_start: '09:00', planned_end: '17:00', block_index: 1 },
    ]
    const result = filterInsertable(entries, today)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-04-29')
  })

  it('filterInsertable excludes entries with null times even for today/future', () => {
    const today = '2026-04-29'
    const entries: DayEntry[] = [
      { date: '2026-04-29', planned_start: null, planned_end: null, block_index: 1 },
      { date: '2026-04-30', planned_start: '09:00', planned_end: null, block_index: 1 },
      { date: '2026-05-01', planned_start: '09:00', planned_end: '17:00', block_index: 1 },
    ]
    const result = filterInsertable(entries, today)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-05-01')
  })

  it('filterInsertable returns all entries when all dates are today or future', () => {
    const today = '2026-04-27'
    const entries: DayEntry[] = PAST_WEEK.map((d) => ({
      date: d,
      planned_start: '09:00',
      planned_end: '17:00',
      block_index: 1,
    }))
    expect(filterInsertable(entries, today)).toHaveLength(5)
  })
})

// ── PROJ-13: QuarterHourTime Zod validation ───────────────────────────────────

describe('PROJ-13: QuarterHourTime Zod refinement', () => {
  it('accepts :00 minutes', () => {
    expect(QuarterHourTime.safeParse('08:00').success).toBe(true)
  })

  it('accepts :15 minutes', () => {
    expect(QuarterHourTime.safeParse('08:15').success).toBe(true)
  })

  it('accepts :30 minutes', () => {
    expect(QuarterHourTime.safeParse('08:30').success).toBe(true)
  })

  it('accepts :45 minutes', () => {
    expect(QuarterHourTime.safeParse('08:45').success).toBe(true)
  })

  it('rejects :10 (non-quarter)', () => {
    expect(QuarterHourTime.safeParse('08:10').success).toBe(false)
  })

  it('rejects :23 (non-quarter)', () => {
    expect(QuarterHourTime.safeParse('09:23').success).toBe(false)
  })

  it('rejects :59 (non-quarter)', () => {
    expect(QuarterHourTime.safeParse('21:59').success).toBe(false)
  })

  it('rejects :01 (non-quarter)', () => {
    expect(QuarterHourTime.safeParse('10:01').success).toBe(false)
  })

  it('rejects non-time string', () => {
    expect(QuarterHourTime.safeParse('not-a-time').success).toBe(false)
  })
})

describe('PROJ-13: DayEntrySchemaV13 with QuarterHourTime', () => {
  it('accepts valid quarter-hour entry', () => {
    expect(DayEntrySchemaV13.safeParse({
      date: '2026-05-05',
      planned_start: '09:00',
      planned_end: '12:30',
      block_index: 1,
    }).success).toBe(true)
  })

  it('rejects planned_start with non-quarter minute', () => {
    expect(DayEntrySchemaV13.safeParse({
      date: '2026-05-05',
      planned_start: '09:23',
      planned_end: '12:00',
      block_index: 1,
    }).success).toBe(false)
  })

  it('rejects planned_end with non-quarter minute', () => {
    expect(DayEntrySchemaV13.safeParse({
      date: '2026-05-05',
      planned_start: '09:00',
      planned_end: '12:47',
      block_index: 1,
    }).success).toBe(false)
  })

  it('accepts null planned_start and planned_end (Kein Arbeitstag)', () => {
    expect(DayEntrySchemaV13.safeParse({
      date: '2026-05-05',
      planned_start: null,
      planned_end: null,
      block_index: 1,
    }).success).toBe(true)
  })
})

// ── PROJ-13: generateTimeOptions logic ────────────────────────────────────────

function generateTimeOptions(): string[] {
  const options: string[] = []
  for (let h = 6; h <= 22; h++) {
    const maxMinute = h === 22 ? 0 : 45
    for (let m = 0; m <= maxMinute; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return options
}

describe('PROJ-13: generateTimeOptions()', () => {
  const options = generateTimeOptions()

  it('produces exactly 65 options (AC: 06:00–22:00 in 15-min steps)', () => {
    expect(options).toHaveLength(65)
  })

  it('first option is 06:00', () => {
    expect(options[0]).toBe('06:00')
  })

  it('last option is 22:00', () => {
    expect(options[options.length - 1]).toBe('22:00')
  })

  it('does not contain 22:15 (boundary: 22:00 is the last)', () => {
    expect(options).not.toContain('22:15')
  })

  it('does not contain 05:45 (below lower bound)', () => {
    expect(options).not.toContain('05:45')
  })

  it('all options have minutes in {0, 15, 30, 45}', () => {
    const validMinutes = new Set([0, 15, 30, 45])
    for (const t of options) {
      const m = parseInt(t.split(':')[1], 10)
      expect(validMinutes.has(m)).toBe(true)
    }
  })

  it('contains 06:15, 06:30, 06:45 (quarter steps after start)', () => {
    expect(options).toContain('06:15')
    expect(options).toContain('06:30')
    expect(options).toContain('06:45')
  })

  it('contains 21:45 (last option before final hour)', () => {
    expect(options).toContain('21:45')
  })
})

// ── PROJ-13: roundToQuarterHour logic ─────────────────────────────────────────

function roundToQuarterHour(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const roundedM = Math.round(m / 15) * 15
  const finalH = roundedM === 60 ? h + 1 : h
  const finalM = roundedM === 60 ? 0 : roundedM
  const result = `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`
  if (result < '06:00') return '06:00'
  if (result > '22:00') return '22:00'
  return result
}

describe('PROJ-13: roundToQuarterHour()', () => {
  it('returns empty string for empty input', () => {
    expect(roundToQuarterHour('')).toBe('')
  })

  it('leaves already-rounded times unchanged: 09:00', () => {
    expect(roundToQuarterHour('09:00')).toBe('09:00')
  })

  it('leaves already-rounded times unchanged: 09:45', () => {
    expect(roundToQuarterHour('09:45')).toBe('09:45')
  })

  it('rounds 09:07 down to 09:00', () => {
    expect(roundToQuarterHour('09:07')).toBe('09:00')
  })

  it('rounds 09:08 up to 09:15', () => {
    expect(roundToQuarterHour('09:08')).toBe('09:15')
  })

  it('rounds 09:23 up to 09:30 (edge case from spec)', () => {
    expect(roundToQuarterHour('09:23')).toBe('09:30')
  })

  it('handles carry-over: rounds 09:53 to 10:00', () => {
    expect(roundToQuarterHour('09:53')).toBe('10:00')
  })

  it('clamps values below 06:00 to 06:00', () => {
    expect(roundToQuarterHour('05:45')).toBe('06:00')
  })

  it('clamps values above 22:00 to 22:00', () => {
    expect(roundToQuarterHour('22:09')).toBe('22:00')
  })

  it('keeps 22:00 as 22:00 (upper boundary)', () => {
    expect(roundToQuarterHour('22:00')).toBe('22:00')
  })
})
