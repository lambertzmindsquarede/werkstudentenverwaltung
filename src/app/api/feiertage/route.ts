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
    const stateKey = bundesland.toUpperCase()
    const raw: Array<{ date: string; fname: string }> = json[stateKey] ?? json[bundesland] ?? []

    const holidays: Feiertag[] = raw.map((h) => ({
      date: h.date,
      name: h.fname,
    }))

    return NextResponse.json(holidays)
  } catch {
    return NextResponse.json([] as Feiertag[])
  }
}
