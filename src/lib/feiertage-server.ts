export async function getHolidayDates(bundesland: string, years: number[]): Promise<Set<string>> {
  const results = await Promise.allSettled(
    years.map(async (year) => {
      const bl = bundesland.toLowerCase()
      const res = await fetch(
        `https://get.api-feiertage.de?states=${bl}&year=${year}`,
        { next: { revalidate: 86400 } }
      )
      if (!res.ok) return [] as string[]
      const json = await res.json()
      const stateKey = bl.toUpperCase()
      const raw: Array<{ date: string }> = json[stateKey] ?? json[bl] ?? []
      return raw.map((h) => h.date)
    })
  )
  const dates = new Set<string>()
  for (const r of results) {
    if (r.status === 'fulfilled') r.value.forEach((d) => dates.add(d))
  }
  return dates
}
