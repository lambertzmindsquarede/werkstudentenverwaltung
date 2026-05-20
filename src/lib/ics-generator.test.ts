import { describe, it, expect } from 'vitest'
import { generateIcs, generateIcsWithMethod, type IcsEntry } from './ics-generator'
import { ICalCalendarMethod } from 'ical-generator'

const baseEntry: IcsEntry = {
  userId: 'user-123',
  date: '2026-05-20',
  fullName: 'Max Mustermann',
  plannedStart: '09:00',
  plannedEnd: '17:00',
  sequence: 0,
  cancel: false,
}

describe('generateIcs', () => {
  it('generates valid VCALENDAR wrapper', () => {
    const ics = generateIcs([baseEntry])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
  })

  it('sets stable UID with wsv-{userId}-{date} schema', () => {
    const ics = generateIcs([baseEntry])
    expect(ics).toContain('UID:wsv-user-123-2026-05-20@werkstudentenverwaltung')
  })

  it('formats SUMMARY with name, times and decimal hours (German comma, iCal-escaped)', () => {
    const ics = generateIcs([baseEntry])
    // ical-generator escapes commas per RFC 5545 → "8\,0 Stunden"; calendar clients render it as "8,0"
    expect(ics).toContain('Max Mustermann 09:00 - 17:00 Uhr (8\\,0 Stunden)')
  })

  it('rounds hours to one decimal with German comma (iCal-escaped)', () => {
    const entry: IcsEntry = { ...baseEntry, plannedStart: '08:00', plannedEnd: '12:30' }
    const ics = generateIcs([entry])
    // 4.5 hours → "4\,5 Stunden" in raw ICS
    expect(ics).toContain('(4\\,5 Stunden)')
  })

  it('sets TRANSP:TRANSPARENT (show as free)', () => {
    const ics = generateIcs([baseEntry])
    expect(ics).toContain('TRANSP:TRANSPARENT')
  })

  it('sets all-day event (DTSTART;VALUE=DATE format)', () => {
    const ics = generateIcs([baseEntry])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260520')
    // DTEND should be the next day
    expect(ics).toContain('DTEND;VALUE=DATE:20260521')
  })

  it('sets SEQUENCE:0 on first send', () => {
    const ics = generateIcs([{ ...baseEntry, sequence: 0 }])
    expect(ics).toContain('SEQUENCE:0')
  })

  it('sets SEQUENCE:1 on update', () => {
    const ics = generateIcs([{ ...baseEntry, sequence: 1 }])
    expect(ics).toContain('SEQUENCE:1')
  })

  it('generates cancel event with CANCELLED status and [ABGESAGT] summary', () => {
    const cancelEntry: IcsEntry = {
      ...baseEntry,
      sequence: 1,
      cancel: true,
      plannedStart: '00:00',
      plannedEnd: '00:00',
    }
    const ics = generateIcs([cancelEntry])
    expect(ics).toContain('[ABGESAGT] Max Mustermann')
    expect(ics).toContain('STATUS:CANCELLED')
  })

  it('generates multiple VEVENTs for multiple entries', () => {
    const monday: IcsEntry = { ...baseEntry, date: '2026-05-18' }
    const tuesday: IcsEntry = { ...baseEntry, date: '2026-05-19' }
    const ics = generateIcs([monday, tuesday])
    const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length
    expect(count).toBe(2)
    expect(ics).toContain('UID:wsv-user-123-2026-05-18@werkstudentenverwaltung')
    expect(ics).toContain('UID:wsv-user-123-2026-05-19@werkstudentenverwaltung')
  })

  it('returns empty calendar (no VEVENTs) for empty entries', () => {
    const ics = generateIcs([])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})

describe('generateIcsWithMethod', () => {
  it('sets METHOD:REQUEST for REQUEST method', () => {
    const ics = generateIcsWithMethod([baseEntry], ICalCalendarMethod.REQUEST)
    expect(ics).toContain('METHOD:REQUEST')
  })

  it('sets METHOD:CANCEL for CANCEL method', () => {
    const cancelEntry: IcsEntry = { ...baseEntry, cancel: true, sequence: 1 }
    const ics = generateIcsWithMethod([cancelEntry], ICalCalendarMethod.CANCEL)
    expect(ics).toContain('METHOD:CANCEL')
  })

  it('generateIcs (no method) does not include METHOD line', () => {
    const ics = generateIcs([baseEntry])
    expect(ics).not.toContain('METHOD:')
  })
})
