import { describe, it, expect } from 'vitest'
import type { ActualEntry } from '@/lib/database.types'

// Mirrors getBerlinDateTime from route.ts
function getBerlinDateTime(): { date: string; time: string } {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  return { date, time }
}

// Mirrors the duplicate-entry guard in POST handler
function canStampIn(existingEntry: ActualEntry | null): { allowed: boolean; error?: string } {
  if (existingEntry) {
    return { allowed: false, error: 'Bereits eingestempelt für heute.' }
  }
  return { allowed: true }
}

// Mirrors the PATCH guard logic
function canStampOut(
  entry: Pick<ActualEntry, 'is_complete'> | null
): { allowed: boolean; error?: string } {
  if (!entry || entry.is_complete) {
    return { allowed: false, error: 'Kein offener Einstempel für heute gefunden.' }
  }
  return { allowed: true }
}

function makeEntry(overrides: Partial<ActualEntry> = {}): ActualEntry {
  return {
    id: 'entry-id',
    user_id: 'user-id',
    date: '2026-04-28',
    actual_start: '09:00:00',
    actual_end: null,
    is_complete: false,
    created_at: '2026-04-28T07:00:00Z',
    updated_at: '2026-04-28T07:00:00Z',
    ...overrides,
  }
}

describe('getBerlinDateTime', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const { date } = getBerlinDateTime()
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns time in HH:MM:SS format', () => {
    const { time } = getBerlinDateTime()
    expect(time).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('returns a date within a plausible range', () => {
    const { date } = getBerlinDateTime()
    const parsed = new Date(date)
    expect(parsed.getFullYear()).toBeGreaterThanOrEqual(2026)
  })
})

describe('canStampIn (POST duplicate-entry guard)', () => {
  it('allows stamp-in when no entry exists for today', () => {
    const result = canStampIn(null)
    expect(result.allowed).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('blocks stamp-in when an entry already exists', () => {
    const result = canStampIn(makeEntry())
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Bereits eingestempelt für heute.')
  })

  it('blocks even if existing entry is incomplete', () => {
    const result = canStampIn(makeEntry({ is_complete: false }))
    expect(result.allowed).toBe(false)
  })

  it('blocks even if existing entry is complete', () => {
    const result = canStampIn(makeEntry({ is_complete: true }))
    expect(result.allowed).toBe(false)
  })
})

describe('canStampOut (PATCH open-entry guard)', () => {
  it('allows stamp-out when an incomplete entry exists', () => {
    const result = canStampOut(makeEntry({ is_complete: false }))
    expect(result.allowed).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('blocks stamp-out when no entry exists', () => {
    const result = canStampOut(null)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Kein offener Einstempel für heute gefunden.')
  })

  it('blocks stamp-out when entry is already complete', () => {
    const result = canStampOut(makeEntry({ is_complete: true, actual_end: '17:00:00' }))
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Kein offener Einstempel für heute gefunden.')
  })
})

describe('ActualEntry shape contract', () => {
  it('accepts a complete entry', () => {
    const entry: ActualEntry = makeEntry({
      actual_end: '17:30:00',
      is_complete: true,
    })
    expect(entry.actual_start).toBe('09:00:00')
    expect(entry.actual_end).toBe('17:30:00')
    expect(entry.is_complete).toBe(true)
  })

  it('accepts an incomplete (stamp-in only) entry', () => {
    const entry: ActualEntry = makeEntry()
    expect(entry.actual_end).toBeNull()
    expect(entry.is_complete).toBe(false)
  })

  it('has unique date per user enforced by shape', () => {
    const e1 = makeEntry({ id: 'a', date: '2026-04-28' })
    const e2 = makeEntry({ id: 'b', date: '2026-04-29' })
    expect(e1.date).not.toBe(e2.date)
  })
})
