import { describe, it, expect } from 'vitest'
import { clampWeek, trimAbsences } from './logic'
import type { AbsenceWithType } from '@/lib/database.types'

const CURRENT = '2026-W40'

function absence(userId: string, date: string): AbsenceWithType {
  return {
    id: `abs-${userId}-${date}`,
    user_id: userId,
    bereich_id: 'b1',
    absence_type_id: 'krank-id',
    absence_type_override_id: null,
    date,
    note: 'private Notiz',
    created_at: '2026-09-01T00:00:00Z',
    absence_type: { id: 'krank-id', name: 'Krank', color: '#ef4444', abbreviation: 'K' },
    absence_type_override: null,
  }
}

describe('clampWeek', () => {
  it('keeps the current week', () => {
    expect(clampWeek('2026-W40', CURRENT)).toBe('2026-W40')
  })

  it('keeps future weeks, also across year boundaries', () => {
    expect(clampWeek('2026-W45', CURRENT)).toBe('2026-W45')
    expect(clampWeek('2027-W02', CURRENT)).toBe('2027-W02')
  })

  it('clamps past weeks to the current week', () => {
    expect(clampWeek('2026-W39', CURRENT)).toBe(CURRENT)
    expect(clampWeek('2025-W52', CURRENT)).toBe(CURRENT)
  })

  it('clamps malformed input to the current week', () => {
    expect(clampWeek('', CURRENT)).toBe(CURRENT)
    expect(clampWeek('2026-W5', CURRENT)).toBe(CURRENT)
    expect(clampWeek('kw40', CURRENT)).toBe(CURRENT)
    expect(clampWeek("2026-W40'; DROP TABLE", CURRENT)).toBe(CURRENT)
  })
})

describe('trimAbsences', () => {
  it('reduces colleague absences to user_id and date only', () => {
    const { teamAbsences } = trimAbsences([absence('colleague', '2026-09-28')], 'me')
    expect(teamAbsences).toEqual([{ user_id: 'colleague', date: '2026-09-28' }])
    // Keine weiteren Felder — Typ, Notiz und IDs dürfen nicht enthalten sein
    expect(Object.keys(teamAbsences[0]).sort()).toEqual(['date', 'user_id'])
  })

  it('keeps the full record only for the own user', () => {
    const { ownAbsences } = trimAbsences(
      [absence('me', '2026-09-28'), absence('colleague', '2026-09-29')],
      'me'
    )
    expect(ownAbsences).toHaveLength(1)
    expect(ownAbsences[0].user_id).toBe('me')
    expect(ownAbsences[0].absence_type?.name).toBe('Krank')
  })

  it('includes the own absence in the neutral team list as well', () => {
    const { teamAbsences } = trimAbsences([absence('me', '2026-09-28')], 'me')
    expect(teamAbsences).toEqual([{ user_id: 'me', date: '2026-09-28' }])
  })

  it('handles empty input', () => {
    expect(trimAbsences([], 'me')).toEqual({ teamAbsences: [], ownAbsences: [] })
  })
})
