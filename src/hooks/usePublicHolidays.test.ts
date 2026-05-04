import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchHolidaysForDates } from './usePublicHolidays'

// Note: the module has a module-level cache Map.
// Use unique bundesland/year combos per test to avoid cache interference.

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetchOk(holidays: { date: string; name: string }[]) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => holidays,
  } as Response)
}

describe('fetchHolidaysForDates', () => {
  it('returns an empty Map when the API returns no holidays', async () => {
    mockFetchOk([])

    const result = await fetchHolidaysForDates('T1', ['3001-07-04'])
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('maps date strings to holiday names', async () => {
    mockFetchOk([
      { date: '3002-01-01', name: 'Neujahr' },
      { date: '3002-12-25', name: '1. Weihnachtstag' },
    ])

    const result = await fetchHolidaysForDates('T2', ['3002-01-01', '3002-12-25'])
    expect(result.get('3002-01-01')).toBe('Neujahr')
    expect(result.get('3002-12-25')).toBe('1. Weihnachtstag')
  })

  it('makes two fetch calls when dates span two calendar years', async () => {
    mockFetchOk([])

    await fetchHolidaysForDates('T3', ['3003-12-31', '3004-01-01'])
    // One call per unique year
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('makes one fetch call when all dates are in the same year', async () => {
    mockFetchOk([])

    await fetchHolidaysForDates('T4', ['3005-01-01', '3005-06-15', '3005-12-31'])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns empty Map when the API throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const result = await fetchHolidaysForDates('T5', ['3006-06-15'])
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('returns empty Map when the API response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    const result = await fetchHolidaysForDates('T6', ['3007-06-15'])
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('merges holidays from two years into a single Map', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: '3008-12-31', name: 'Silvester' }],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: '3009-01-01', name: 'Neujahr' }],
      } as Response)

    const result = await fetchHolidaysForDates('T7', ['3008-12-31', '3009-01-01'])
    expect(result.get('3008-12-31')).toBe('Silvester')
    expect(result.get('3009-01-01')).toBe('Neujahr')
    expect(result.size).toBe(2)
  })
})
