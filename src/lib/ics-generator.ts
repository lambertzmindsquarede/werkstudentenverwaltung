import ical, { ICalCalendarMethod, ICalEventTransparency } from 'ical-generator'

export interface IcsEntry {
  userId: string
  date: string // YYYY-MM-DD
  fullName: string
  plannedStart: string // HH:MM
  plannedEnd: string   // HH:MM
  sequence: number
  cancel?: boolean
}

function parseHHMM(time: string): { h: number; m: number } {
  const [h, m] = time.split(':').map(Number)
  return { h, m }
}

function hoursDecimal(start: string, end: string): string {
  const s = parseHHMM(start)
  const e = parseHHMM(end)
  const totalMinutes = (e.h * 60 + e.m) - (s.h * 60 + s.m)
  const hours = totalMinutes / 60
  return hours.toFixed(1).replace('.', ',')
}

function allDayDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z')
}

function allDayDatePlusOne(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export function generateIcs(entries: IcsEntry[]): string {
  const cal = ical({ name: 'Werkstudenten-Wochenplan' })

  for (const entry of entries) {
    const eventId = `wsv-${entry.userId}-${entry.date}@werkstudentenverwaltung`
    const summary = entry.cancel
      ? `[ABGESAGT] ${entry.fullName}`
      : `${entry.fullName} ${entry.plannedStart} - ${entry.plannedEnd} Uhr (${hoursDecimal(entry.plannedStart, entry.plannedEnd)} Stunden)`

    const event = cal.createEvent({
      id: eventId,
      summary,
      start: allDayDate(entry.date),
      end: allDayDatePlusOne(entry.date),
      allDay: true,
      sequence: entry.sequence,
      transparency: ICalEventTransparency.TRANSPARENT,
    })

    if (entry.cancel) {
      event.status('CANCELLED' as Parameters<typeof event.status>[0])
    }
  }

  return cal.toString()
}

export function generateIcsWithMethod(entries: IcsEntry[], method: ICalCalendarMethod): string {
  const cal = ical({ name: 'Werkstudenten-Wochenplan', method })

  for (const entry of entries) {
    const eventId = `wsv-${entry.userId}-${entry.date}@werkstudentenverwaltung`
    const summary = entry.cancel
      ? `[ABGESAGT] ${entry.fullName}`
      : `${entry.fullName} ${entry.plannedStart} - ${entry.plannedEnd} Uhr (${hoursDecimal(entry.plannedStart, entry.plannedEnd)} Stunden)`

    const event = cal.createEvent({
      id: eventId,
      summary,
      start: allDayDate(entry.date),
      end: allDayDatePlusOne(entry.date),
      allDay: true,
      sequence: entry.sequence,
      transparency: ICalEventTransparency.TRANSPARENT,
    })

    if (entry.cancel) {
      event.status('CANCELLED' as Parameters<typeof event.status>[0])
    }
  }

  return cal.toString()
}
