import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import path from 'path'
import fs from 'fs'

function dateToExcelSerial(date: Date): number {
  const excelEpoch = new Date(1899, 11, 30)
  return Math.round((date.getTime() - excelEpoch.getTime()) / 86400000)
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minutesToHhmm(minutes: number): number {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h * 100 + m
}

function setCell(ws: XLSX.WorkSheet, addr: string, value: string | number) {
  ws[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's' }
}

function clearCell(ws: XLSX.WorkSheet, addr: string) {
  if (ws[addr] && !ws[addr].f) {
    delete ws[addr]
  } else if (ws[addr]) {
    ws[addr] = { v: '', t: 's', f: ws[addr].f }
  }
}

function normalizeNamePart(s: string): string {
  return s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
}

function buildFileName(year: number, month: number, fullName: string): string {
  const mm = String(month).padStart(2, '0')
  const parts = fullName.trim().split(' ')
  const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''
  const lastNorm = normalizeNamePart(lastName)
  const firstNorm = normalizeNamePart(firstName)
  return firstNorm ? `${year}-${mm}_${lastNorm}_${firstNorm}.xlsx` : `${year}-${mm}_${lastNorm}.xlsx`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { userId, from, to } = body as { userId?: string; from: string; to: string }

  const targetUserId = userId ?? user.id
  const adminClient = createAdminClient()

  // Access check: caller must be the user or an authorized manager/admin
  if (targetUserId !== user.id) {
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'manager' && !callerProfile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!callerProfile?.is_admin) {
      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('bereich_id')
        .eq('id', targetUserId)
        .single()
      const { data: bm } = await adminClient
        .from('bereich_manager')
        .select('bereich_id')
        .eq('user_id', user.id)
      const managerBereichIds = (bm ?? []).map((b) => b.bereich_id)
      if (!targetProfile?.bereich_id || !managerBereichIds.includes(targetProfile.bereich_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name, personalnummer')
    .eq('id', targetUserId)
    .single()

  if (!profile?.personalnummer) {
    return NextResponse.json({ error: 'Personalnummer fehlt' }, { status: 400 })
  }

  const { data: entries } = await adminClient
    .from('actual_entries')
    .select('*')
    .eq('user_id', targetUserId)
    .gte('date', from)
    .lte('date', to)
    .eq('is_complete', true)
    .order('date')
    .order('block_index')

  const byDate: Record<string, typeof entries> = {}
  for (const entry of entries ?? []) {
    if (!byDate[entry.date]) byDate[entry.date] = []
    byDate[entry.date]!.push(entry)
  }

  // Determine calendar months covered by the range
  const fromDate = new Date(from + 'T00:00:00')
  const toDate = new Date(to + 'T00:00:00')
  const months: { year: number; month: number }[] = []
  let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
  const toMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 1)
  while (cur <= toMonth) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }

  const templatePath = path.join(process.cwd(), 'src/lib/export/template.xlsx')
  const templateBuffer = fs.readFileSync(templatePath)

  const xlsxFiles: { name: string; buffer: Buffer }[] = []

  for (const { year, month } of months) {
    const wb = XLSX.read(templateBuffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]

    setCell(ws, 'E5', profile.full_name ?? '')
    setCell(ws, 'E7', dateToExcelSerial(new Date(year, month - 1, 1)))
    setCell(ws, 'E9', profile.personalnummer)

    const daysInMonth = new Date(year, month, 0).getDate()

    for (let day = 1; day <= 31; day++) {
      const excelRow = 13 + day
      const cAddr = `C${excelRow}`
      const dAddr = `D${excelRow}`
      const eAddr = `E${excelRow}`

      if (day > daysInMonth) {
        clearCell(ws, cAddr)
        clearCell(ws, dAddr)
        clearCell(ws, eAddr)
        continue
      }

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (dateStr < from || dateStr > to) {
        clearCell(ws, cAddr)
        clearCell(ws, dAddr)
        clearCell(ws, eAddr)
        continue
      }

      const dayEntries = (byDate[dateStr] ?? []).filter((e) => e.actual_start && e.actual_end)
      if (dayEntries.length === 0) {
        clearCell(ws, cAddr)
        clearCell(ws, dAddr)
        clearCell(ws, eAddr)
        continue
      }

      const sorted = [...dayEntries].sort(
        (a, b) => timeToMinutes(a.actual_start!) - timeToMinutes(b.actual_start!)
      )
      const startMin = timeToMinutes(sorted[0].actual_start!)
      const endMin = timeToMinutes(sorted[sorted.length - 1].actual_end!)

      let pauseMin = sorted.reduce((sum, e) => sum + (e.break_minutes ?? 0), 0)
      for (let i = 1; i < sorted.length; i++) {
        const gapStart = timeToMinutes(sorted[i - 1].actual_end!)
        const gapEnd = timeToMinutes(sorted[i].actual_start!)
        if (gapEnd > gapStart) pauseMin += gapEnd - gapStart
      }

      setCell(ws, cAddr, minutesToHhmm(startMin))
      if (pauseMin > 0) {
        setCell(ws, dAddr, minutesToHhmm(pauseMin))
      } else {
        clearCell(ws, dAddr)
      }
      setCell(ws, eAddr, minutesToHhmm(endMin))
    }

    const fileName = buildFileName(year, month, profile.full_name ?? '')
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
    xlsxFiles.push({ name: fileName, buffer })
  }

  if (xlsxFiles.length === 0) {
    return NextResponse.json({ error: 'Keine Dateien generiert' }, { status: 400 })
  }

  if (xlsxFiles.length === 1) {
    return new NextResponse(new Uint8Array(xlsxFiles[0].buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFiles[0].name}"`,
      },
    })
  }

  const zip = new JSZip()
  for (const file of xlsxFiles) {
    zip.file(file.name, file.buffer)
  }
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="stundenzettel.zip"',
    },
  })
}
