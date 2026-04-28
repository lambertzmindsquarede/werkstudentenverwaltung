import { describe, it, expect } from 'vitest'

// Mirrors calcHours from StempelCard.tsx and WochenIstübersicht.tsx
function calcHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = eh * 60 + em - (sh * 60 + sm)
  return diff > 0 ? diff / 60 : 0
}

// Mirrors formatTime from StempelCard.tsx and WochenIstübersicht.tsx
function formatTime(time: string | null): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

// Mirrors calcDiff from WochenIstübersicht.tsx
type DiffResult = { text: string; positive: boolean }
function calcDiff(planH: number, istH: number): DiffResult | null {
  if (planH === 0 && istH === 0) return null
  const diff = istH - planH
  if (diff === 0) return { text: '±0h', positive: true }
  const sign = diff > 0 ? '+' : ''
  return { text: sign + diff.toFixed(1).replace('.', ',') + 'h', positive: diff >= 0 }
}

// Mirrors timeToMinutes from IstEintragEditDialog.tsx
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

describe('calcHours', () => {
  it('returns correct hours for standard 8-hour day', () => {
    expect(calcHours('09:00:00', '17:00:00')).toBe(8)
  })

  it('returns correct fractional hours', () => {
    expect(calcHours('09:00:00', '09:30:00')).toBeCloseTo(0.5)
  })

  it('returns 0 when start is null', () => {
    expect(calcHours(null, '17:00:00')).toBe(0)
  })

  it('returns 0 when end is null', () => {
    expect(calcHours('09:00:00', null)).toBe(0)
  })

  it('returns 0 when both are null', () => {
    expect(calcHours(null, null)).toBe(0)
  })

  it('returns 0 when end equals start (0h day)', () => {
    expect(calcHours('09:00:00', '09:00:00')).toBe(0)
  })

  it('returns 0 when end is before start (negative diff)', () => {
    expect(calcHours('17:00:00', '09:00:00')).toBe(0)
  })

  it('handles times without seconds (HH:MM format)', () => {
    expect(calcHours('08:00', '16:00')).toBe(8)
  })

  it('correctly accumulates hours for a short shift', () => {
    expect(calcHours('10:15:00', '12:45:00')).toBeCloseTo(2.5)
  })

  it('handles exactly 10 hours (boundary for long-day warning)', () => {
    expect(calcHours('08:00:00', '18:00:00')).toBe(10)
  })

  it('handles more than 10 hours', () => {
    expect(calcHours('07:00:00', '18:00:00')).toBeCloseTo(11)
  })
})

describe('formatTime', () => {
  it('formats time with seconds to HH:MM', () => {
    expect(formatTime('09:15:00')).toBe('09:15')
  })

  it('returns dash for null', () => {
    expect(formatTime(null)).toBe('—')
  })

  it('passes through HH:MM unchanged', () => {
    expect(formatTime('14:30')).toBe('14:30')
  })

  it('slices correctly for midnight', () => {
    expect(formatTime('00:00:00')).toBe('00:00')
  })
})

describe('calcDiff', () => {
  it('returns null when both plan and ist are 0', () => {
    expect(calcDiff(0, 0)).toBeNull()
  })

  it('returns ±0h when plan equals ist', () => {
    const result = calcDiff(8, 8)
    expect(result?.text).toBe('±0h')
    expect(result?.positive).toBe(true)
  })

  it('returns positive diff when ist > plan', () => {
    const result = calcDiff(8, 10)
    expect(result?.text).toBe('+2,0h')
    expect(result?.positive).toBe(true)
  })

  it('returns negative diff when ist < plan', () => {
    const result = calcDiff(8, 6)
    expect(result?.text).toBe('-2,0h')
    expect(result?.positive).toBe(false)
  })

  it('returns non-null when ist has hours but plan is 0 (unplanned work)', () => {
    const result = calcDiff(0, 4)
    expect(result).not.toBeNull()
    expect(result?.positive).toBe(true)
  })

  it('returns non-null when plan has hours but ist is 0 (absent)', () => {
    const result = calcDiff(8, 0)
    expect(result).not.toBeNull()
    expect(result?.positive).toBe(false)
  })

  it('formats fractional diff with German decimal separator', () => {
    const result = calcDiff(8, 9.5)
    expect(result?.text).toBe('+1,5h')
  })
})

describe('timeToMinutes (IstEintragEditDialog validation)', () => {
  it('converts midnight to 0', () => {
    expect(timeToMinutes('00:00')).toBe(0)
  })

  it('converts 1h to 60', () => {
    expect(timeToMinutes('01:00')).toBe(60)
  })

  it('converts 09:30 correctly', () => {
    expect(timeToMinutes('09:30')).toBe(570)
  })

  it('converts 23:59 to 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

describe('startAfterEnd validation logic (IstEintragEditDialog)', () => {
  function isInvalidRange(start: string, end: string): boolean {
    return timeToMinutes(start) >= timeToMinutes(end)
  }

  it('blocks when start equals end', () => {
    expect(isInvalidRange('09:00', '09:00')).toBe(true)
  })

  it('blocks when start is after end', () => {
    expect(isInvalidRange('17:00', '09:00')).toBe(true)
  })

  it('allows valid range', () => {
    expect(isInvalidRange('09:00', '17:00')).toBe(false)
  })

  it('allows one-minute range', () => {
    expect(isInvalidRange('09:00', '09:01')).toBe(false)
  })
})

describe('isLongDay detection (IstEintragEditDialog)', () => {
  function isLongDay(start: string, end: string): boolean {
    const startMinutes = timeToMinutes(start)
    const endMinutes = timeToMinutes(end)
    if (startMinutes >= endMinutes) return false
    const hours = (endMinutes - startMinutes) / 60
    return hours > 10
  }

  it('flags exactly 10,5 hours as long day', () => {
    expect(isLongDay('08:00', '18:30')).toBe(true)
  })

  it('does not flag exactly 10 hours', () => {
    expect(isLongDay('08:00', '18:00')).toBe(false)
  })

  it('does not flag 8-hour day', () => {
    expect(isLongDay('09:00', '17:00')).toBe(false)
  })

  it('returns false for invalid range (start after end)', () => {
    expect(isLongDay('17:00', '09:00')).toBe(false)
  })
})
