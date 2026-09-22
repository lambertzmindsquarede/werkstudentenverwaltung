import { describe, it, expect } from 'vitest'
import { getPlanLabel, sortMembersOwnFirst, getInitials, formatHours } from './utils'
import type { PlannedEntry } from '@/lib/database.types'
import type { TeamKalenderMember } from '@/app/dashboard/team-kalender/actions'

function plan(start: string, end: string): PlannedEntry {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    date: '2026-09-22',
    planned_start: start,
    planned_end: end,
    block_index: 0,
    arbeitsort_id: null,
    created_at: '',
    updated_at: '',
  }
}

function member(id: string, name: string): TeamKalenderMember {
  return { id, full_name: name, weekly_hours: 20, bundesland: 'NW' }
}

describe('getPlanLabel', () => {
  it('returns null label for empty plans', () => {
    expect(getPlanLabel([])).toEqual({ label: null, hours: 0 })
  })

  it('formats a single block with times and hours', () => {
    const result = getPlanLabel([plan('08:00:00', '16:30:00')])
    expect(result.label).toBe('08:00 – 16:30')
    expect(result.hours).toBe(8.5)
  })

  it('summarizes multiple blocks with count and total hours', () => {
    const result = getPlanLabel([plan('08:00:00', '12:00:00'), plan('13:00:00', '17:00:00')])
    expect(result.label).toBe('2 Bl. · 8h')
    expect(result.hours).toBe(8)
  })
})

describe('formatHours', () => {
  it('drops decimals for whole hours', () => {
    expect(formatHours(8)).toBe('8h')
  })

  it('keeps one decimal for fractional hours', () => {
    expect(formatHours(8.5)).toBe('8.5h')
  })
})

describe('sortMembersOwnFirst', () => {
  it('moves the own member to the front and keeps server order otherwise', () => {
    const members = [member('a', 'Anna'), member('b', 'Ben'), member('c', 'Cem')]
    const sorted = sortMembersOwnFirst(members, 'b')
    expect(sorted.map((m) => m.id)).toEqual(['b', 'a', 'c'])
  })

  it('does not mutate the input array', () => {
    const members = [member('a', 'Anna'), member('b', 'Ben')]
    sortMembersOwnFirst(members, 'b')
    expect(members.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('handles an own id that is not in the list', () => {
    const members = [member('a', 'Anna'), member('b', 'Ben')]
    expect(sortMembersOwnFirst(members, 'x').map((m) => m.id)).toEqual(['a', 'b'])
  })
})

describe('getInitials', () => {
  it('builds initials from first and last name', () => {
    expect(getInitials('Max Mustermann')).toBe('MM')
  })

  it('uses a single letter for one-word names', () => {
    expect(getInitials('Max')).toBe('M')
  })

  it('falls back to ? for null or empty names', () => {
    expect(getInitials(null)).toBe('?')
    expect(getInitials('   ')).toBe('?')
  })
})
