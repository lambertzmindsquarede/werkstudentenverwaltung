import { describe, it, expect } from 'vitest'
import { aggregateByDate } from './ics-sender'

describe('aggregateByDate', () => {
  it('returns single entry unchanged', () => {
    const result = aggregateByDate([{ date: '2026-05-20', plannedStart: '09:00', plannedEnd: '17:00' }])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: '2026-05-20', plannedStart: '09:00', plannedEnd: '17:00' })
  })

  it('merges two blocks on the same day: keeps earliest start and latest end', () => {
    const result = aggregateByDate([
      { date: '2026-05-20', plannedStart: '09:00', plannedEnd: '12:00' },
      { date: '2026-05-20', plannedStart: '13:00', plannedEnd: '17:00' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].plannedStart).toBe('09:00')
    expect(result[0].plannedEnd).toBe('17:00')
  })

  it('keeps separate entries for different dates', () => {
    const result = aggregateByDate([
      { date: '2026-05-18', plannedStart: '08:00', plannedEnd: '16:00' },
      { date: '2026-05-19', plannedStart: '09:00', plannedEnd: '17:00' },
    ])
    expect(result).toHaveLength(2)
  })

  it('handles three blocks on the same day correctly', () => {
    const result = aggregateByDate([
      { date: '2026-05-20', plannedStart: '08:00', plannedEnd: '10:00' },
      { date: '2026-05-20', plannedStart: '11:00', plannedEnd: '13:00' },
      { date: '2026-05-20', plannedStart: '14:00', plannedEnd: '17:00' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].plannedStart).toBe('08:00')
    expect(result[0].plannedEnd).toBe('17:00')
  })

  it('returns empty array for empty input', () => {
    expect(aggregateByDate([])).toHaveLength(0)
  })

  it('preserves date field in aggregated entry', () => {
    const result = aggregateByDate([
      { date: '2026-05-20', plannedStart: '09:00', plannedEnd: '12:00' },
      { date: '2026-05-20', plannedStart: '13:00', plannedEnd: '17:00' },
    ])
    expect(result[0].date).toBe('2026-05-20')
  })
})
