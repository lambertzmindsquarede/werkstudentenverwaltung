import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 86400

export interface Feiertag {
  date: string
  name: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const bundesland = (searchParams.get('bundesland') ?? 'NW').toLowerCase()
  const year = searchParams.get('year') ?? new Date().getFullYear().toString()

  try {
    const res = await fetch(
      `https://get.api-feiertage.de?states=${bundesland}&year=${year}`,
      { next: { revalidate: 86400 } }
    )

    if (!res.ok) {
      return NextResponse.json([] as Feiertag[])
    }

    const json = await res.json()
    const allFeiertage: Array<{ date: string; fname: string; [key: string]: string | null }> = json.feiertage ?? []
    const raw = allFeiertage.filter((h) => h[bundesland] === '1' && h.date.startsWith(year))

    const holidays: Feiertag[] = raw.map((h) => ({
      date: h.date,
      name: h.fname,
    }))

    return NextResponse.json(holidays)
  } catch {
    return NextResponse.json([] as Feiertag[])
  }
}
