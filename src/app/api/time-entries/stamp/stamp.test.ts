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

// Mirrors the POST guard logic (multi-block)
function canStampIn(
  openBlock: Pick<ActualEntry, 'id'> | null,
  blockCount: number
): { allowed: boolean; error?: string } {
  if (openBlock) {
    return { allowed: false, error: 'Bitte zuerst ausstempeln.' }
  }
  if (blockCount >= 3) {
    return { allowed: false, error: 'Maximum 3 Blöcke pro Tag erreicht.' }
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

// Mirrors block_index assignment in POST handler
function nextBlockIndex(blockCount: number): number {
  return blockCount + 1
}

function makeEntry(overrides: Partial<ActualEntry> = {}): ActualEntry {
  return {
    id: 'entry-id',
    user_id: 'user-id',
    date: '2026-04-28',
    actual_start: '09:00:00',
    actual_end: null,
    is_complete: false,
    block_index: 1,
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

describe('canStampIn (POST multi-block guard)', () => {
  it('allows stamp-in when no open block and 0 blocks today', () => {
    const result = canStampIn(null, 0)
    expect(result.allowed).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('allows stamp-in when no open block and 1 complete block today', () => {
    const result = canStampIn(null, 1)
    expect(result.allowed).toBe(true)
  })

  it('allows stamp-in when no open block and 2 complete blocks today', () => {
    const result = canStampIn(null, 2)
    expect(result.allowed).toBe(true)
  })

  it('blocks stamp-in when an open block exists (must stamp out first)', () => {
    const result = canStampIn({ id: 'open-block-id' }, 1)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Bitte zuerst ausstempeln.')
  })

  it('blocks stamp-in when 3 blocks already exist', () => {
    const result = canStampIn(null, 3)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Maximum 3 Blöcke pro Tag erreicht.')
  })

  it('open block check takes priority over count check', () => {
    const result = canStampIn({ id: 'open-block-id' }, 3)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Bitte zuerst ausstempeln.')
  })
})

describe('nextBlockIndex', () => {
  it('returns 1 for first block of the day', () => {
    expect(nextBlockIndex(0)).toBe(1)
  })

  it('returns 2 for second block', () => {
    expect(nextBlockIndex(1)).toBe(2)
  })

  it('returns 3 for third block', () => {
    expect(nextBlockIndex(2)).toBe(3)
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
  it('accepts a complete entry with block_index', () => {
    const entry: ActualEntry = makeEntry({
      actual_end: '17:30:00',
      is_complete: true,
      block_index: 1,
    })
    expect(entry.actual_start).toBe('09:00:00')
    expect(entry.actual_end).toBe('17:30:00')
    expect(entry.is_complete).toBe(true)
    expect(entry.block_index).toBe(1)
  })

  it('accepts an incomplete (stamp-in only) entry', () => {
    const entry: ActualEntry = makeEntry()
    expect(entry.actual_end).toBeNull()
    expect(entry.is_complete).toBe(false)
  })

  it('allows multiple entries per date with different block_index', () => {
    const block1 = makeEntry({ id: 'a', block_index: 1, actual_end: '12:00:00', is_complete: true })
    const block2 = makeEntry({ id: 'b', block_index: 2, actual_start: '14:00:00', actual_end: null, is_complete: false })
    expect(block1.date).toBe(block2.date)
    expect(block1.block_index).not.toBe(block2.block_index)
  })

  it('accepts null block_index for legacy entries', () => {
    const entry: ActualEntry = makeEntry({ block_index: null })
    expect(entry.block_index).toBeNull()
  })
})
