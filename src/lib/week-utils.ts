export function getISOWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function getCurrentISOWeek(): string {
  return getISOWeekString(new Date())
}

export function weekStringToMonday(weekStr: string): Date {
  const [yearStr, weekPart] = weekStr.split('-W')
  const year = parseInt(yearStr, 10)
  const week = parseInt(weekPart, 10)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(4 - jan4Day + 1 + (week - 1) * 7)
  return monday
}

export function getWeekDates(weekStr: string): Date[] {
  const monday = weekStringToMonday(weekStr)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    return d
  })
}

export function getPreviousWeek(weekStr: string): string {
  const monday = weekStringToMonday(weekStr)
  const prev = new Date(monday)
  prev.setUTCDate(monday.getUTCDate() - 7)
  return getISOWeekString(prev)
}

export function getNextWeek(weekStr: string): string {
  const monday = weekStringToMonday(weekStr)
  const next = new Date(monday)
  next.setUTCDate(monday.getUTCDate() + 7)
  return getISOWeekString(next)
}

export function dateToString(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
}

export function getWeekDateRange(weekStr: string): string {
  const dates = getWeekDates(weekStr)
  return `${formatDate(dates[0])} – ${formatDate(dates[4])}`
}

export function getCalendarWeekNumber(weekStr: string): number {
  return parseInt(weekStr.split('-W')[1], 10)
}
