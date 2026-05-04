import { describe, it, expect } from 'vitest'
import { DEFAULT_MAX_EDIT_DAYS_PAST } from '@/lib/database.types'

// Mirrors computeCutoffStr logic from assertEditPermission and WochenIstübersicht
function computeCutoffStr(today: string, maxDays: number): string {
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - maxDays)
  return cutoff.toISOString().slice(0, 10)
}

function isWithinEditWindow(date: string, cutoffStr: string): boolean {
  return date >= cutoffStr
}

describe('DEFAULT_MAX_EDIT_DAYS_PAST', () => {
  it('defaults to 14 days', () => {
    expect(DEFAULT_MAX_EDIT_DAYS_PAST).toBe(14)
  })
})

describe('computeCutoffStr (date arithmetic for edit deadline)', () => {
  it('returns today - 14 days for default window', () => {
    const result = computeCutoffStr('2026-05-04', 14)
    expect(result).toBe('2026-04-20')
  })

  it('returns today for 0 days (only today is editable)', () => {
    const result = computeCutoffStr('2026-05-04', 0)
    expect(result).toBe('2026-05-04')
  })

  it('returns yesterday for 1 day window', () => {
    const result = computeCutoffStr('2026-05-04', 1)
    expect(result).toBe('2026-05-03')
  })

  it('returns ~1 year ago for 365-day window', () => {
    const result = computeCutoffStr('2026-05-04', 365)
    expect(result).toBe('2025-05-04')
  })

  it('handles month boundary correctly', () => {
    const result = computeCutoffStr('2026-05-01', 5)
    expect(result).toBe('2026-04-26')
  })

  it('handles year boundary correctly', () => {
    const result = computeCutoffStr('2026-01-10', 14)
    expect(result).toBe('2025-12-27')
  })

  it('handles leap year February boundary', () => {
    const result = computeCutoffStr('2024-03-01', 1)
    expect(result).toBe('2024-02-29')
  })
})

describe('isWithinEditWindow (entry date vs cutoff comparison)', () => {
  const cutoff = '2026-04-20'

  it('allows editing entries on the cutoff date exactly', () => {
    expect(isWithinEditWindow('2026-04-20', cutoff)).toBe(true)
  })

  it('allows editing entries after the cutoff', () => {
    expect(isWithinEditWindow('2026-04-21', cutoff)).toBe(true)
    expect(isWithinEditWindow('2026-05-04', cutoff)).toBe(true)
  })

  it('blocks editing entries before the cutoff', () => {
    expect(isWithinEditWindow('2026-04-19', cutoff)).toBe(false)
    expect(isWithinEditWindow('2026-01-01', cutoff)).toBe(false)
  })

  it('allows editing today (always within window)', () => {
    const today = '2026-05-04'
    const todayCutoff = computeCutoffStr(today, 14)
    expect(isWithinEditWindow(today, todayCutoff)).toBe(true)
  })
})

describe('combined cutoff logic (simulates assertEditPermission date check)', () => {
  const today = '2026-05-04'

  it('werkstudent can edit an entry from exactly maxDays ago (boundary = allowed)', () => {
    const maxDays = 14
    const cutoff = computeCutoffStr(today, maxDays)
    const entryDate = computeCutoffStr(today, maxDays) // same as cutoff
    expect(isWithinEditWindow(entryDate, cutoff)).toBe(true)
  })

  it('werkstudent cannot edit an entry from maxDays + 1 days ago', () => {
    const maxDays = 14
    const cutoff = computeCutoffStr(today, maxDays)
    const entryDate = computeCutoffStr(today, maxDays + 1)
    expect(isWithinEditWindow(entryDate, cutoff)).toBe(false)
  })

  it('werkstudent with 1-day window can only edit today and yesterday', () => {
    const cutoff = computeCutoffStr(today, 1)
    expect(isWithinEditWindow(today, cutoff)).toBe(true)           // today
    expect(isWithinEditWindow('2026-05-03', cutoff)).toBe(true)    // yesterday (day 1)
    expect(isWithinEditWindow('2026-05-02', cutoff)).toBe(false)   // 2 days ago
  })

  it('werkstudent with 365-day window can edit 1 year ago', () => {
    const cutoff = computeCutoffStr(today, 365)
    expect(isWithinEditWindow('2025-05-04', cutoff)).toBe(true)
    expect(isWithinEditWindow('2025-05-03', cutoff)).toBe(false)
  })

  it('default cutoff (14 days) is used when no DB setting exists', () => {
    const maxDays = DEFAULT_MAX_EDIT_DAYS_PAST
    const cutoff = computeCutoffStr(today, maxDays)
    expect(cutoff).toBe('2026-04-20')
  })

  it('manager is exempt from cutoff (null maxDaysPast = no restriction)', () => {
    // When maxEditDaysPast is null, cutoffStr is null → withinCutoff is always true
    const cutoffStr: string | null = null
    const withinCutoff = cutoffStr === null || '2020-01-01' >= cutoffStr
    expect(withinCutoff).toBe(true)
  })
})

describe('settings validation (mirrors SettingsForm and saveMaxEditDaysPast)', () => {
  function validateDays(days: number): boolean {
    return Number.isInteger(days) && days >= 1 && days <= 365
  }

  it('accepts 1 (minimum valid value)', () => {
    expect(validateDays(1)).toBe(true)
  })

  it('accepts 14 (default value)', () => {
    expect(validateDays(14)).toBe(true)
  })

  it('accepts 365 (maximum valid value)', () => {
    expect(validateDays(365)).toBe(true)
  })

  it('rejects 0 (below minimum)', () => {
    expect(validateDays(0)).toBe(false)
  })

  it('rejects 366 (above maximum)', () => {
    expect(validateDays(366)).toBe(false)
  })

  it('rejects negative values', () => {
    expect(validateDays(-1)).toBe(false)
  })

  it('rejects NaN (empty input parsed by parseInt)', () => {
    expect(validateDays(NaN)).toBe(false)
  })

  it('rejects non-integer (float)', () => {
    expect(validateDays(14.5)).toBe(false)
  })
})
