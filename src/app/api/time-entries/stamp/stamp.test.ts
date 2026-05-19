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

// Mirrors the POST guard logic (multi-block, including absence check)
function canStampIn(
  hasAbsenceToday: boolean,
  openBlock: Pick<ActualEntry, 'id'> | null,
  blockCount: number
): { allowed: boolean; error?: string } {
  if (hasAbsenceToday) {
    return { allowed: false, error: 'Du bist heute als abwesend eingetragen. Einstempeln ist nicht möglich.' }
  }
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
  it('allows stamp-in when no absence, no open block, and 0 blocks today', () => {
    const result = canStampIn(false, null, 0)
    expect(result.allowed).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('allows stamp-in when no absence, no open block, and 1 complete block today', () => {
    const result = canStampIn(false, null, 1)
    expect(result.allowed).toBe(true)
  })

  it('allows stamp-in when no absence, no open block, and 2 complete blocks today', () => {
    const result = canStampIn(false, null, 2)
    expect(result.allowed).toBe(true)
  })

  it('blocks stamp-in when absence is recorded for today', () => {
    const result = canStampIn(true, null, 0)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Du bist heute als abwesend eingetragen. Einstempeln ist nicht möglich.')
  })

  it('absence check takes priority over open-block check', () => {
    const result = canStampIn(true, { id: 'open-block-id' }, 0)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Du bist heute als abwesend eingetragen. Einstempeln ist nicht möglich.')
  })

  it('blocks stamp-in when an open block exists (must stamp out first)', () => {
    const result = canStampIn(false, { id: 'open-block-id' }, 1)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Bitte zuerst ausstempeln.')
  })

  it('blocks stamp-in when 3 blocks already exist', () => {
    const result = canStampIn(false, null, 3)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Maximum 3 Blöcke pro Tag erreicht.')
  })

  it('open block check takes priority over count check', () => {
    const result = canStampIn(false, { id: 'open-block-id' }, 3)
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

// ── PROJ-26: Time field schema validation ─────────────────────────────────────

function validateTimeField(value: string | undefined): { ok: boolean; error?: string } {
  if (value === undefined) return { ok: true }
  if (!/^\d{2}:\d{2}$/.test(value)) return { ok: false, error: 'Ungültiges Zeitformat (HH:MM erwartet).' }
  if (parseInt(value.split(':')[1], 10) % 5 !== 0) return { ok: false, error: 'Minuten müssen ein Vielfaches von 5 sein.' }
  return { ok: true }
}

// Mirrors future-time guard in route.ts
function isFutureTime(requestedTime: string, nowHHMM: string): boolean {
  return requestedTime > nowHHMM
}

// Mirrors last-block-end guard in POST route
function isBeforeLastBlockEnd(requestedTime: string, lastEnd: string): boolean {
  return requestedTime <= lastEnd
}

// Mirrors minimum-1-minute guard in PATCH route
function isLessThanOneMinuteAfterStart(requestedTime: string, actualStart: string): boolean {
  const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  return toMinutes(requestedTime) - toMinutes(actualStart.slice(0, 5)) < 1
}

// Mirrors getBerlinTimeRounded from StempelCard.tsx (spec says round UP – spec example: 09:13 → 09:15)
function getBerlinTimeRoundedFloor(minuteValue: number): number {
  return Math.floor(minuteValue / 5) * 5
}
function getBerlinTimeRoundedCeil(minuteValue: number): number {
  return Math.ceil(minuteValue / 5) * 5
}

describe('PROJ-26: timeFieldSchema validation', () => {
  it('accepts valid time "09:15"', () => {
    expect(validateTimeField('09:15').ok).toBe(true)
  })

  it('accepts valid time "00:00"', () => {
    expect(validateTimeField('00:00').ok).toBe(true)
  })

  it('accepts valid time "23:55"', () => {
    expect(validateTimeField('23:55').ok).toBe(true)
  })

  it('accepts undefined (optional field)', () => {
    expect(validateTimeField(undefined).ok).toBe(true)
  })

  it('rejects format "9:15" (missing leading zero)', () => {
    const result = validateTimeField('9:15')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/HH:MM/)
  })

  it('rejects format "09:5" (missing leading zero on minute)', () => {
    const result = validateTimeField('09:5')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/HH:MM/)
  })

  it('rejects "09:13" (minute not a multiple of 5)', () => {
    const result = validateTimeField('09:13')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Vielfaches/)
  })

  it('rejects "09:01" (minute not a multiple of 5)', () => {
    const result = validateTimeField('09:01')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Vielfaches/)
  })

  it('rejects "abc:de" (non-numeric)', () => {
    const result = validateTimeField('abc:de')
    expect(result.ok).toBe(false)
  })
})

describe('PROJ-26: future-time guard', () => {
  it('rejects a time that is in the future', () => {
    expect(isFutureTime('14:30', '14:00')).toBe(true)
  })

  it('accepts a time equal to now', () => {
    expect(isFutureTime('14:00', '14:00')).toBe(false)
  })

  it('accepts a time in the past', () => {
    expect(isFutureTime('13:55', '14:00')).toBe(false)
  })

  it('midnight boundary: 23:55 is past relative to 23:55', () => {
    expect(isFutureTime('23:55', '23:55')).toBe(false)
  })
})

describe('PROJ-26: stamp-in – last block end guard', () => {
  it('rejects time exactly equal to last block end', () => {
    expect(isBeforeLastBlockEnd('10:00', '10:00')).toBe(true)
  })

  it('rejects time before last block end', () => {
    expect(isBeforeLastBlockEnd('09:55', '10:00')).toBe(true)
  })

  it('accepts time strictly after last block end', () => {
    expect(isBeforeLastBlockEnd('10:05', '10:00')).toBe(false)
  })
})

describe('PROJ-26: stamp-out – minimum 1 minute after start guard', () => {
  it('rejects time exactly equal to start (0 min diff)', () => {
    expect(isLessThanOneMinuteAfterStart('09:00', '09:00:00')).toBe(true)
  })

  it('rejects time that would be 0 minutes after start with different format', () => {
    expect(isLessThanOneMinuteAfterStart('09:00', '09:00:30')).toBe(true)
  })

  it('accepts time exactly 1 minute after start', () => {
    expect(isLessThanOneMinuteAfterStart('09:01', '09:00:00')).toBe(false)
  })

  it('accepts time 5 minutes after start', () => {
    expect(isLessThanOneMinuteAfterStart('09:05', '09:00:00')).toBe(false)
  })
})

describe('PROJ-26: getBerlinTimeRounded – rounding direction', () => {
  // Spec says: "nächste volle 5 Minuten gerundet (z.B. 09:13 → 09:15)" → CEILING
  // BUG: current implementation uses Math.floor which rounds DOWN
  it('floor (current impl): minute 13 rounds to 10 [spec expects 15]', () => {
    expect(getBerlinTimeRoundedFloor(13)).toBe(10)
  })

  it('ceil (spec intent): minute 13 rounds to 15', () => {
    expect(getBerlinTimeRoundedCeil(13)).toBe(15)
  })

  it('ceil: minute already on boundary (10) stays at 10', () => {
    expect(getBerlinTimeRoundedCeil(10)).toBe(10)
  })

  it('ceil: minute 0 stays at 0', () => {
    expect(getBerlinTimeRoundedCeil(0)).toBe(0)
  })

  it('ceil: minute 1 rounds to 5', () => {
    expect(getBerlinTimeRoundedCeil(1)).toBe(5)
  })

  it('ceil: minute 56 rounds to 60 (overflow — caller must handle)', () => {
    expect(getBerlinTimeRoundedCeil(56)).toBe(60)
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
