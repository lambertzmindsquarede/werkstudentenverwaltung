import { describe, it, expect } from 'vitest'
import {
  getAbsenceName,
  getAbsenceColor,
  getAbsenceAbbreviation,
  type AbsenceWithType,
} from './database.types'

function makeAbsence(overrides: Partial<AbsenceWithType> = {}): AbsenceWithType {
  return {
    id: 'test-id',
    user_id: 'user-1',
    bereich_id: null,
    absence_type_id: null,
    absence_type_override_id: null,
    date: '2026-05-07',
    note: null,
    created_at: '2026-05-07T08:00:00Z',
    absence_type: null,
    absence_type_override: null,
    ...overrides,
  }
}

describe('getAbsenceName', () => {
  it('returns override name when override is present', () => {
    const a = makeAbsence({
      absence_type_override: { id: 'o1', name: 'Custom', color: '#000', abbreviation: 'C' },
      absence_type: { id: 't1', name: 'Krank', color: '#ef4444', abbreviation: 'K' },
    })
    expect(getAbsenceName(a)).toBe('Custom')
  })

  it('returns global type name when no override', () => {
    const a = makeAbsence({
      absence_type: { id: 't1', name: 'Urlaub', color: '#3b82f6', abbreviation: 'U' },
    })
    expect(getAbsenceName(a)).toBe('Urlaub')
  })

  it('returns fallback "Abwesend" when neither type nor override', () => {
    const a = makeAbsence()
    expect(getAbsenceName(a)).toBe('Abwesend')
  })
})

describe('getAbsenceColor', () => {
  it('returns override color when override is present', () => {
    const a = makeAbsence({
      absence_type_override: { id: 'o1', name: 'Custom', color: '#ff0000', abbreviation: 'C' },
    })
    expect(getAbsenceColor(a)).toBe('#ff0000')
  })

  it('returns global type color when no override', () => {
    const a = makeAbsence({
      absence_type: { id: 't1', name: 'Krank', color: '#ef4444', abbreviation: 'K' },
    })
    expect(getAbsenceColor(a)).toBe('#ef4444')
  })

  it('returns fallback grey when neither type nor override', () => {
    const a = makeAbsence()
    expect(getAbsenceColor(a)).toBe('#94a3b8')
  })

  it('returns fallback grey when override has null color', () => {
    const a = makeAbsence({
      absence_type_override: { id: 'o1', name: 'Custom', color: null, abbreviation: 'C' },
    })
    expect(getAbsenceColor(a)).toBe('#94a3b8')
  })
})

describe('getAbsenceAbbreviation', () => {
  it('returns override abbreviation when override is present', () => {
    const a = makeAbsence({
      absence_type_override: { id: 'o1', name: 'Custom', color: '#000', abbreviation: 'X' },
    })
    expect(getAbsenceAbbreviation(a)).toBe('X')
  })

  it('returns global type abbreviation when no override', () => {
    const a = makeAbsence({
      absence_type: { id: 't1', name: 'Krank', color: '#ef4444', abbreviation: 'K' },
    })
    expect(getAbsenceAbbreviation(a)).toBe('K')
  })

  it('returns fallback "?" when neither type nor override', () => {
    const a = makeAbsence()
    expect(getAbsenceAbbreviation(a)).toBe('?')
  })
})

describe('7-day delete window logic', () => {
  it('absence date within 7 days should be deletable', () => {
    const today = new Date()
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(today.getDate() - 2)
    const dateStr = twoDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    expect(dateStr >= sevenDaysAgoStr).toBe(true)
  })

  it('absence date older than 7 days should NOT be deletable', () => {
    const today = new Date()
    const eightDaysAgo = new Date(today)
    eightDaysAgo.setDate(today.getDate() - 8)
    const dateStr = eightDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    expect(dateStr >= sevenDaysAgoStr).toBe(false)
  })

  it('future absence date should be deletable', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    expect(dateStr >= sevenDaysAgoStr).toBe(true)
  })
})

describe('7-day retroactive entry window logic', () => {
  it('absence date within 7 days can be entered retroactively', () => {
    const today = new Date()
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(today.getDate() - 3)
    const dateStr = threeDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    expect(dateStr < sevenDaysAgoStr).toBe(false)
  })

  it('absence date older than 7 days is blocked', () => {
    const today = new Date()
    const tenDaysAgo = new Date(today)
    tenDaysAgo.setDate(today.getDate() - 10)
    const dateStr = tenDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv', { timeZone: 'Europe/Berlin' })

    expect(dateStr < sevenDaysAgoStr).toBe(true)
  })
})
