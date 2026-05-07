import { describe, it, expect } from 'vitest'

// Mirrors pure utility functions from route.ts for isolated testing

function normalizeNamePart(s: string): string {
  return s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
}

function buildFileName(year: number, month: number, fullName: string): string {
  const mm = String(month).padStart(2, '0')
  const parts = fullName.trim().split(' ')
  const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''
  const lastNorm = normalizeNamePart(lastName)
  const firstNorm = normalizeNamePart(firstName)
  return firstNorm ? `${year}-${mm}_${lastNorm}_${firstNorm}.xlsx` : `${year}-${mm}_${lastNorm}.xlsx`
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minutesToHhmm(minutes: number): number {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h * 100 + m
}

// ─── normalizeNamePart ────────────────────────────────────────────────────────

describe('normalizeNamePart', () => {
  it('passes through plain ASCII names unchanged', () => {
    expect(normalizeNamePart('Mueller')).toBe('Mueller')
  })

  it('converts ä → ae, ö → oe, ü → ue (lowercase)', () => {
    expect(normalizeNamePart('müller')).toBe('mueller')
    expect(normalizeNamePart('schäfer')).toBe('schaefer')
    expect(normalizeNamePart('größe')).toBe('groesse')
  })

  it('converts ß → ss', () => {
    expect(normalizeNamePart('straße')).toBe('strasse')
  })

  it('converts Ä → Ae, Ö → Oe, Ü → Ue (uppercase)', () => {
    expect(normalizeNamePart('Änn')).toBe('Aenn')
    expect(normalizeNamePart('Öl')).toBe('Oel')
    expect(normalizeNamePart('Über')).toBe('Ueber')
  })

  it('replaces spaces with underscores', () => {
    expect(normalizeNamePart('Max Moritz')).toBe('Max_Moritz')
  })

  it('removes special characters except alphanumeric, underscore, dash', () => {
    expect(normalizeNamePart("O'Brien")).toBe('OBrien')
    expect(normalizeNamePart('Mc-Fly')).toBe('Mc-Fly')
    expect(normalizeNamePart('name.suffix')).toBe('namesuffix')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeNamePart('')).toBe('')
  })
})

// ─── buildFileName ────────────────────────────────────────────────────────────

describe('buildFileName', () => {
  it('builds correct filename for standard two-part name (Nachname_Vorname order)', () => {
    expect(buildFileName(2026, 5, 'Max Mustermann')).toBe('2026-05_Mustermann_Max.xlsx')
  })

  it('pads single-digit month with leading zero', () => {
    expect(buildFileName(2026, 1, 'Anna Schmidt')).toBe('2026-01_Schmidt_Anna.xlsx')
    expect(buildFileName(2026, 9, 'Anna Schmidt')).toBe('2026-09_Schmidt_Anna.xlsx')
  })

  it('does not pad two-digit months', () => {
    expect(buildFileName(2026, 12, 'Anna Schmidt')).toBe('2026-12_Schmidt_Anna.xlsx')
    expect(buildFileName(2025, 10, 'Anna Schmidt')).toBe('2025-10_Schmidt_Anna.xlsx')
  })

  it('uses name directly without underscore for single-word full_name (edge case from spec)', () => {
    expect(buildFileName(2026, 5, 'Madonna')).toBe('2026-05_Madonna.xlsx')
  })

  it('normalizes umlauts in last name', () => {
    expect(buildFileName(2026, 8, 'Anna Müller')).toBe('2026-08_Mueller_Anna.xlsx')
  })

  it('normalizes umlauts in first name', () => {
    expect(buildFileName(2026, 8, 'Jürgen Schmid')).toBe('2026-08_Schmid_Juergen.xlsx')
  })

  it('normalizes ß in last name', () => {
    expect(buildFileName(2026, 5, 'Karl Straßer')).toBe('2026-05_Strasser_Karl.xlsx')
  })

  it('handles three-part name: last word = Nachname, remainder = Vorname', () => {
    expect(buildFileName(2026, 5, 'Max Moritz Mustermann')).toBe('2026-05_Mustermann_Max_Moritz.xlsx')
  })

  it('trims leading/trailing whitespace from full_name', () => {
    expect(buildFileName(2026, 5, '  Max Mustermann  ')).toBe('2026-05_Mustermann_Max.xlsx')
  })
})

// ─── timeToMinutes ────────────────────────────────────────────────────────────

describe('timeToMinutes', () => {
  it('converts 00:00 to 0', () => {
    expect(timeToMinutes('00:00')).toBe(0)
  })

  it('converts 08:30 to 510', () => {
    expect(timeToMinutes('08:30')).toBe(510)
  })

  it('converts 17:00 to 1020', () => {
    expect(timeToMinutes('17:00')).toBe(1020)
  })

  it('converts 23:59 to 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

// ─── minutesToHhmm ────────────────────────────────────────────────────────────

describe('minutesToHhmm', () => {
  it('converts 510 (08:30) → 830', () => {
    expect(minutesToHhmm(510)).toBe(830)
  })

  it('converts 0 (00:00) → 0', () => {
    expect(minutesToHhmm(0)).toBe(0)
  })

  it('converts 1020 (17:00) → 1700', () => {
    expect(minutesToHhmm(1020)).toBe(1700)
  })

  it('converts 570 (09:30) → 930', () => {
    expect(minutesToHhmm(570)).toBe(930)
  })

  it('converts 2359 minutes would overflow — 23:59 = 1439 min → 2359', () => {
    expect(minutesToHhmm(1439)).toBe(2359)
  })

  it('converts 65 (01:05) → 105', () => {
    expect(minutesToHhmm(65)).toBe(105)
  })

  it('converts 600 (10:00) → 1000', () => {
    expect(minutesToHhmm(600)).toBe(1000)
  })
})
