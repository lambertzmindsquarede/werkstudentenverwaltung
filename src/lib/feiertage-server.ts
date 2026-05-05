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
      const allFeiertage: Array<{ date: string; [key: string]: string | null }> = json.feiertage ?? []
      return allFeiertage.filter((h) => h[bl] === '1').map((h) => h.date)
    })
  )
  const dates = new Set<string>()
  for (const r of results) {
    if (r.status === 'fulfilled') r.value.forEach((d) => dates.add(d))
  }
  return dates
}
