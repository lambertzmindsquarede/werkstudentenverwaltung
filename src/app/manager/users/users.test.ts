import { describe, it, expect } from 'vitest'
import type { Profile } from '@/lib/database.types'

// Mirrors the getInitials implementation in users/page.tsx
function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Mirrors the filter logic in UsersPage
type FilterStatus = 'all' | 'pending' | 'active' | 'inactive'
type FilterRole = 'all' | 'werkstudent' | 'manager'

function filterUsers(users: Profile[], filterStatus: FilterStatus, filterRole: FilterRole) {
  return users.filter((u) => {
    const statusMatch =
      filterStatus === 'all' ||
      (filterStatus === 'pending' && !u.role) ||
      (filterStatus === 'active' && u.role && u.is_active !== false) ||
      (filterStatus === 'inactive' && u.role && u.is_active === false)

    const roleMatch = filterRole === 'all' || u.role === filterRole

    return statusMatch && roleMatch
  })
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'test-id',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'werkstudent',
    weekly_hour_limit: 20,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('getInitials', () => {
  it('returns ? for null name', () => {
    expect(getInitials(null)).toBe('?')
  })

  it('returns initials for single name', () => {
    expect(getInitials('Anna')).toBe('A')
  })

  it('returns two-letter initials for full name', () => {
    expect(getInitials('Max Mustermann')).toBe('MM')
  })

  it('truncates to 2 characters for multi-word names', () => {
    expect(getInitials('Anna Berta Clara')).toBe('AB')
  })

  it('returns uppercase initials', () => {
    expect(getInitials('max mustermann')).toBe('MM')
  })
})

describe('filterUsers', () => {
  const pending = makeProfile({ id: '1', role: null, is_active: true })
  const activeWerkstudent = makeProfile({ id: '2', role: 'werkstudent', is_active: true })
  const inactiveWerkstudent = makeProfile({ id: '3', role: 'werkstudent', is_active: false })
  const activeManager = makeProfile({ id: '4', role: 'manager', is_active: true })
  const inactiveManager = makeProfile({ id: '5', role: 'manager', is_active: false })

  const all = [pending, activeWerkstudent, inactiveWerkstudent, activeManager, inactiveManager]

  it('returns all users when filter is all/all', () => {
    expect(filterUsers(all, 'all', 'all')).toHaveLength(5)
  })

  it('returns only pending users', () => {
    const result = filterUsers(all, 'pending', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('returns only active users', () => {
    const result = filterUsers(all, 'active', 'all')
    expect(result).toHaveLength(2)
    expect(result.map((u) => u.id)).toEqual(expect.arrayContaining(['2', '4']))
  })

  it('returns only inactive users', () => {
    const result = filterUsers(all, 'inactive', 'all')
    expect(result).toHaveLength(2)
    expect(result.map((u) => u.id)).toEqual(expect.arrayContaining(['3', '5']))
  })

  it('filters by role=werkstudent', () => {
    const result = filterUsers(all, 'all', 'werkstudent')
    expect(result).toHaveLength(2)
    expect(result.every((u) => u.role === 'werkstudent')).toBe(true)
  })

  it('filters by role=manager', () => {
    const result = filterUsers(all, 'all', 'manager')
    expect(result).toHaveLength(2)
    expect(result.every((u) => u.role === 'manager')).toBe(true)
  })

  it('combining pending + werkstudent role returns empty (pending users have no role)', () => {
    const result = filterUsers(all, 'pending', 'werkstudent')
    expect(result).toHaveLength(0)
  })

  it('combining active + manager returns only active managers', () => {
    const result = filterUsers(all, 'active', 'manager')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('4')
  })

  it('treats is_active=null as active (existing behavior)', () => {
    const nullActive = makeProfile({ id: '6', role: 'werkstudent', is_active: null })
    const result = filterUsers([nullActive], 'active', 'all')
    expect(result).toHaveLength(1)
  })
})
