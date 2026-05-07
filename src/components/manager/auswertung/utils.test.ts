import { describe, it, expect } from 'vitest'
import { minutesToHHMM } from './utils'

describe('minutesToHHMM', () => {
  it('converts 0 minutes to 00:00', () => {
    expect(minutesToHHMM(0)).toBe('00:00')
  })

  it('converts 60 minutes to 01:00', () => {
    expect(minutesToHHMM(60)).toBe('01:00')
  })

  it('converts 90 minutes to 01:30', () => {
    expect(minutesToHHMM(90)).toBe('01:30')
  })

  it('converts 480 minutes (8h) to 08:00', () => {
    expect(minutesToHHMM(480)).toBe('08:00')
  })

  it('converts 495 minutes (8h 15m) to 08:15', () => {
    expect(minutesToHHMM(495)).toBe('08:15')
  })

  it('pads hours and minutes with leading zeros', () => {
    expect(minutesToHHMM(5)).toBe('00:05')
  })

  it('handles large values like 840 (14h)', () => {
    expect(minutesToHHMM(840)).toBe('14:00')
  })

  it('handles negative values by using absolute value', () => {
    expect(minutesToHHMM(-90)).toBe('01:30')
  })
})
