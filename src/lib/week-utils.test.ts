import { describe, it, expect } from 'vitest'
import {
  getISOWeekString,
  weekStringToMonday,
  getWeekDates,
  getPreviousWeek,
  getNextWeek,
  dateToString,
  getWeekDateRange,
  getCalendarWeekNumber,
} from './week-utils'

describe('getISOWeekString', () => {
  it('returns correct week string for a known Monday', () => {
    expect(getISOWeekString(new Date('2026-04-27'))).toBe('2026-W18')
  })

  it('returns correct week string for a Friday in same week', () => {
    expect(getISOWeekString(new Date('2026-05-01'))).toBe('2026-W18')
  })

  it('handles year boundary – last week of 2025', () => {
    expect(getISOWeekString(new Date('2025-12-29'))).toBe('2026-W01')
  })

  it('handles week 1 of 2026', () => {
    expect(getISOWeekString(new Date('2026-01-05'))).toBe('2026-W02')
  })

  it('handles first week of January that belongs to previous year', () => {
    // 2021-01-01 is a Friday; ISO week 53 of 2020
    expect(getISOWeekString(new Date('2021-01-01'))).toBe('2020-W53')
  })
})

describe('weekStringToMonday', () => {
  it('returns Monday for 2026-W18', () => {
    const d = weekStringToMonday('2026-W18')
    expect(d.getUTCDay()).toBe(1) // Monday
    expect(dateToString(d)).toBe('2026-04-27')
  })

  it('returns Monday for 2026-W01', () => {
    const d = weekStringToMonday('2026-W01')
    expect(dateToString(d)).toBe('2025-12-29')
  })
})

describe('getWeekDates', () => {
  it('returns 5 dates (Mon–Fri)', () => {
    expect(getWeekDates('2026-W18')).toHaveLength(5)
  })

  it('starts on Monday and ends on Friday', () => {
    const dates = getWeekDates('2026-W18')
    expect(dates[0].getUTCDay()).toBe(1)
    expect(dates[4].getUTCDay()).toBe(5)
  })

  it('returns correct date strings for 2026-W18', () => {
    const dates = getWeekDates('2026-W18').map(dateToString)
    expect(dates).toEqual([
      '2026-04-27',
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
    ])
  })
})

describe('getPreviousWeek', () => {
  it('returns week before', () => {
    expect(getPreviousWeek('2026-W18')).toBe('2026-W17')
  })

  it('wraps year boundary correctly', () => {
    expect(getPreviousWeek('2026-W01')).toBe('2025-W52')
  })
})

describe('getNextWeek', () => {
  it('returns week after', () => {
    expect(getNextWeek('2026-W18')).toBe('2026-W19')
  })

  it('wraps year boundary correctly', () => {
    expect(getNextWeek('2025-W52')).toBe('2026-W01')
  })
})

describe('dateToString', () => {
  it('formats UTC date as YYYY-MM-DD', () => {
    expect(dateToString(new Date('2026-04-27T00:00:00Z'))).toBe('2026-04-27')
  })
})

describe('getWeekDateRange', () => {
  it('formats range as DD.MM. – DD.MM.', () => {
    expect(getWeekDateRange('2026-W18')).toBe('27.04. – 01.05.')
  })
})

describe('getCalendarWeekNumber', () => {
  it('extracts week number', () => {
    expect(getCalendarWeekNumber('2026-W18')).toBe(18)
  })

  it('handles leading zero', () => {
    expect(getCalendarWeekNumber('2026-W01')).toBe(1)
  })
})
