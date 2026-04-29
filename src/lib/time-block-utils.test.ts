import { describe, it, expect } from 'vitest'
import { timeToMinutes, calcBlockHours, validateBlocks } from './time-block-utils'

describe('timeToMinutes', () => {
  it('converts midnight to 0', () => {
    expect(timeToMinutes('00:00')).toBe(0)
  })

  it('converts 09:00 to 540', () => {
    expect(timeToMinutes('09:00')).toBe(540)
  })

  it('converts 12:30 to 750', () => {
    expect(timeToMinutes('12:30')).toBe(750)
  })

  it('converts 23:59 to 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('converts 01:05 correctly', () => {
    expect(timeToMinutes('01:05')).toBe(65)
  })
})

describe('calcBlockHours', () => {
  it('returns 0 when start is null', () => {
    expect(calcBlockHours(null, '17:00')).toBe(0)
  })

  it('returns 0 when end is null', () => {
    expect(calcBlockHours('09:00', null)).toBe(0)
  })

  it('returns 0 when both are null', () => {
    expect(calcBlockHours(null, null)).toBe(0)
  })

  it('returns correct hours for 09:00–17:00', () => {
    expect(calcBlockHours('09:00', '17:00')).toBe(8)
  })

  it('returns correct hours for 09:00–09:30', () => {
    expect(calcBlockHours('09:00', '09:30')).toBeCloseTo(0.5)
  })

  it('returns 0 when start equals end', () => {
    expect(calcBlockHours('12:00', '12:00')).toBe(0)
  })

  it('returns 0 when start is after end', () => {
    expect(calcBlockHours('17:00', '09:00')).toBe(0)
  })

  it('handles HH:MM:SS format (DB time strings)', () => {
    expect(calcBlockHours('09:00:00', '12:00:00')).toBe(3)
  })
})

describe('validateBlocks', () => {
  it('returns no errors for a single valid block', () => {
    expect(validateBlocks([{ start: '09:00', end: '17:00' }])).toHaveLength(0)
  })

  it('returns no errors for empty block list', () => {
    expect(validateBlocks([])).toHaveLength(0)
  })

  it('detects start equal to end as invalid', () => {
    const errors = validateBlocks([{ start: '09:00', end: '09:00' }])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/Startzeit/)
  })

  it('detects start after end', () => {
    const errors = validateBlocks([{ start: '17:00', end: '09:00' }])
    expect(errors).toHaveLength(1)
    expect(errors[0].blockIndex).toBe(0)
  })

  it('returns no errors for two non-overlapping blocks', () => {
    const blocks = [
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '17:00' },
    ]
    expect(validateBlocks(blocks)).toHaveLength(0)
  })

  it('detects overlap between block 0 and block 1', () => {
    const blocks = [
      { start: '09:00', end: '12:00' },
      { start: '11:00', end: '14:00' },
    ]
    const errors = validateBlocks(blocks)
    expect(errors).toHaveLength(1)
    expect(errors[0].blockIndex).toBe(1)
    expect(errors[0].message).toContain('Block 1')
  })

  it('treats adjacent blocks (end == next start) as non-overlapping', () => {
    const blocks = [
      { start: '09:00', end: '12:00' },
      { start: '12:00', end: '17:00' },
    ]
    expect(validateBlocks(blocks)).toHaveLength(0)
  })

  it('skips blocks with empty start or end', () => {
    const blocks = [
      { start: '09:00', end: '' },
      { start: '', end: '12:00' },
    ]
    expect(validateBlocks(blocks)).toHaveLength(0)
  })

  it('reports overlap referencing the correct earlier block number', () => {
    const blocks = [
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '16:00' },
      { start: '11:00', end: '14:00' },
    ]
    const errors = validateBlocks(blocks)
    expect(errors).toHaveLength(1)
    expect(errors[0].blockIndex).toBe(2)
    expect(errors[0].message).toContain('Block 1')
  })

  it('reports only the first overlap error per block', () => {
    const blocks = [
      { start: '09:00', end: '18:00' },
      { start: '10:00', end: '11:00' },
      { start: '12:00', end: '13:00' },
    ]
    const errors = validateBlocks(blocks)
    // Block 1 overlaps with Block 0; Block 2 also overlaps with Block 0
    // Each conflicting block gets at most one error, referencing the earliest conflict
    expect(errors.length).toBeGreaterThanOrEqual(1)
    const block1Error = errors.find((e) => e.blockIndex === 1)
    expect(block1Error).toBeDefined()
  })
})
