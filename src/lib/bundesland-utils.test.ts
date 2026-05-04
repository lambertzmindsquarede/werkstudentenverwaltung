import { describe, it, expect } from 'vitest'
import { BUNDESLAENDER, getBundeslandName, DEFAULT_BUNDESLAND } from './bundesland-utils'

describe('BUNDESLAENDER', () => {
  it('has exactly 16 entries (all German states)', () => {
    expect(Object.keys(BUNDESLAENDER)).toHaveLength(16)
  })

  it('contains all 16 ISO-3166-2 codes', () => {
    const expected = ['BB', 'BE', 'BW', 'BY', 'HB', 'HE', 'HH', 'MV', 'NI', 'NW', 'RP', 'SH', 'SL', 'SN', 'ST', 'TH']
    for (const code of expected) {
      expect(BUNDESLAENDER).toHaveProperty(code)
    }
  })

  it('maps NW to Nordrhein-Westfalen', () => {
    expect(BUNDESLAENDER['NW']).toBe('Nordrhein-Westfalen')
  })

  it('maps BY to Bayern', () => {
    expect(BUNDESLAENDER['BY']).toBe('Bayern')
  })
})

describe('DEFAULT_BUNDESLAND', () => {
  it('is NW (company location is NRW)', () => {
    expect(DEFAULT_BUNDESLAND).toBe('NW')
  })
})

describe('getBundeslandName', () => {
  it('returns full name for uppercase NW', () => {
    expect(getBundeslandName('NW')).toBe('Nordrhein-Westfalen')
  })

  it('is case-insensitive — lowercase nw works', () => {
    expect(getBundeslandName('nw')).toBe('Nordrhein-Westfalen')
  })

  it('is case-insensitive — lowercase by works', () => {
    expect(getBundeslandName('by')).toBe('Bayern')
  })

  it('returns full name for BE (Berlin)', () => {
    expect(getBundeslandName('BE')).toBe('Berlin')
  })

  it('returns full name for HH (Hamburg)', () => {
    expect(getBundeslandName('HH')).toBe('Hamburg')
  })

  it('falls back to the code for an unknown code', () => {
    expect(getBundeslandName('XX')).toBe('XX')
  })

  it('falls back to the original input for mixed-case unknown code', () => {
    expect(getBundeslandName('zz')).toBe('zz')
  })

  it('returns empty string for empty input', () => {
    expect(getBundeslandName('')).toBe('')
  })
})
