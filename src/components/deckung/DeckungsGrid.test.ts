import { describe, it, expect } from 'vitest'
import { getUserColor } from './DeckungsGrid'

describe('getUserColor', () => {
  it('returns a color from the palette for any user ID', () => {
    const color = getUserColor('user-123')
    expect(color).toHaveProperty('bg')
    expect(color).toHaveProperty('text')
    expect(color.bg).toMatch(/^bg-/)
    expect(color.text).toBe('text-white')
  })

  it('is deterministic — same ID always returns same color', () => {
    const id = 'abc-def-123'
    const c1 = getUserColor(id)
    const c2 = getUserColor(id)
    expect(c1.bg).toBe(c2.bg)
  })

  it('handles empty string without error', () => {
    expect(() => getUserColor('')).not.toThrow()
    const color = getUserColor('')
    expect(color.bg).toMatch(/^bg-/)
  })

  it('returns different colors for different UUIDs (distribution check)', () => {
    const ids = [
      'aaaa-0000',
      'bbbb-1111',
      'cccc-2222',
      'dddd-3333',
      'eeee-4444',
      'ffff-5555',
    ]
    const colors = ids.map((id) => getUserColor(id).bg)
    const unique = new Set(colors)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('stays in bounds for very long IDs', () => {
    const longId = 'x'.repeat(1000)
    expect(() => getUserColor(longId)).not.toThrow()
    const color = getUserColor(longId)
    expect(color.bg).toMatch(/^bg-/)
  })
})
