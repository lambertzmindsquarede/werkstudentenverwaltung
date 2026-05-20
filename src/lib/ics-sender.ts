import { generateIcsWithMethod, type IcsEntry } from './ics-generator'
import { ICalCalendarMethod } from 'ical-generator'
import { createAdminClient } from './supabase-admin'
import { getCalendarWeekNumber, getWeekDates, dateToString } from './week-utils'

interface SendIcsOptions {
  userId: string
  weekStr: string
  currentEntries: { date: string; plannedStart: string; plannedEnd: string }[]
  fullName: string
}

async function getGraphToken(): Promise<string | null> {
  const tenantId = process.env.AZURE_AD_TENANT_ID
  const clientId = process.env.MAIL_AZURE_CLIENT_ID
  const clientSecret = process.env.MAIL_AZURE_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    console.error('[ics-sender] Missing MAIL_AZURE_CLIENT_ID / MAIL_AZURE_CLIENT_SECRET / AZURE_AD_TENANT_ID')
    return null
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  try {
    const res = await fetch(url, { method: 'POST', body })
    if (!res.ok) {
      console.error('[ics-sender] Token fetch failed:', await res.text())
      return null
    }
    const json = await res.json()
    return json.access_token ?? null
  } catch (err) {
    console.error('[ics-sender] Token fetch error:', err)
    return null
  }
}

async function sendMail(
  token: string,
  to: string[],
  subject: string,
  bodyText: string,
  attachmentContent: string,
  attachmentName: string
): Promise<void> {
  const base64Content = Buffer.from(attachmentContent).toString('base64')
  const url = 'https://graph.microsoft.com/v1.0/users/do-not-reply@mindsquare.de/sendMail'

  const payload = {
    message: {
      subject,
      body: { contentType: 'Text', content: bodyText },
      toRecipients: to.map((addr) => ({ emailAddress: { address: addr } })),
      attachments: [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachmentName,
          contentType: 'text/calendar',
          contentBytes: base64Content,
        },
      ],
    },
    saveToSentItems: false,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    console.error('[ics-sender] sendMail failed:', res.status, await res.text())
  }
}

export function aggregateByDate(
  entries: { date: string; plannedStart: string; plannedEnd: string }[]
): { date: string; plannedStart: string; plannedEnd: string }[] {
  const byDate = new Map<string, { date: string; plannedStart: string; plannedEnd: string }>()
  for (const e of entries) {
    const existing = byDate.get(e.date)
    if (!existing) {
      byDate.set(e.date, { ...e })
    } else {
      if (e.plannedStart < existing.plannedStart) existing.plannedStart = e.plannedStart
      if (e.plannedEnd > existing.plannedEnd) existing.plannedEnd = e.plannedEnd
    }
  }
  return [...byDate.values()]
}

export async function triggerIcsSend({ userId, weekStr, currentEntries, fullName }: SendIcsOptions): Promise<void> {
  try {
    const supabase = createAdminClient()

    // Find all managers responsible for this werkstudent's bereich
    const { data: profile } = await supabase
      .from('profiles')
      .select('bereich_id')
      .eq('id', userId)
      .single()

    if (!profile?.bereich_id) return

    const { data: bereichManagers } = await supabase
      .from('bereich_manager')
      .select('user_id')
      .eq('bereich_id', profile.bereich_id)

    if (!bereichManagers || bereichManagers.length === 0) return

    const managerIds = bereichManagers.map((bm) => bm.user_id)

    // Load ICS settings for each manager
    const { data: icsSettings } = await supabase
      .from('manager_ics_settings')
      .select('manager_id, ics_enabled, additional_emails')
      .in('manager_id', managerIds)
      .eq('ics_enabled', true)

    if (!icsSettings || icsSettings.length === 0) return

    // Load manager email addresses from profiles
    const { data: managerProfiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', managerIds)

    const managerEmailMap = new Map(managerProfiles?.map((p) => [p.id, p.email]) ?? [])

    // Aggregate multiple time blocks per day into one entry (FIX BUG-M2: no duplicate UIDs)
    const aggregatedEntries = aggregateByDate(currentEntries)

    // Query sequences for ALL days of the week so removed days are detected (FIX BUG-M1: CANCEL)
    const allWeekDates = getWeekDates(weekStr).map(dateToString)
    const previousDates = await getPreviousDates(supabase, userId, allWeekDates)

    const token = await getGraphToken()
    if (!token) return

    const kw = getCalendarWeekNumber(weekStr)
    const year = weekStr.split('-W')[0]
    const lastName = fullName.split(' ').pop()?.toLowerCase() ?? 'unbekannt'

    for (const setting of icsSettings) {
      const managerEmail = managerEmailMap.get(setting.manager_id)
      if (!managerEmail) {
        console.warn('[ics-sender] No email for manager', setting.manager_id)
        continue
      }

      const recipients = [managerEmail, ...(setting.additional_emails ?? [])]
      const entries = await buildIcsEntries(supabase, userId, fullName, aggregatedEntries, previousDates)

      if (entries.length === 0) continue

      const icsContent = generateIcsWithMethod(entries, ICalCalendarMethod.REQUEST)
      const attachmentName = `wochenplan-${lastName}-kw${kw}-${year}.ics`
      const subject = `Wochenplan ${fullName} – KW ${kw}, ${year}`
      const bodyText = `Anbei der Wochenplan von ${fullName} für KW ${kw}, ${year}.`

      await sendMail(token, recipients, subject, bodyText, icsContent, attachmentName)
    }

    // Update sequences after sending
    await updateSequences(supabase, userId, aggregatedEntries, previousDates)
  } catch (err) {
    console.error('[ics-sender] Unexpected error:', err)
  }
}

async function getPreviousDates(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  weekDates: string[]
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('ics_event_sequences')
    .select('date, sequence')
    .eq('user_id', userId)
    .in('date', weekDates)

  return new Map((data ?? []).map((r) => [r.date, r.sequence]))
}

async function buildIcsEntries(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  fullName: string,
  currentEntries: { date: string; plannedStart: string; plannedEnd: string }[],
  previousSequences: Map<string, number>
): Promise<IcsEntry[]> {
  // Check all dates that had sequences (even if not in currentEntries)
  const allTrackedDates = [...previousSequences.keys()]
  const currentDates = new Set(currentEntries.map((e) => e.date))

  const result: IcsEntry[] = []

  // Regular + update events
  for (const entry of currentEntries) {
    const prevSeq = previousSequences.get(entry.date)
    result.push({
      userId,
      date: entry.date,
      fullName,
      plannedStart: entry.plannedStart,
      plannedEnd: entry.plannedEnd,
      sequence: prevSeq !== undefined ? prevSeq + 1 : 0,
      cancel: false,
    })
  }

  // Cancel events for days removed from plan
  for (const date of allTrackedDates) {
    if (!currentDates.has(date)) {
      const prevSeq = previousSequences.get(date)!
      // Need to know the last start/end for the CANCEL summary — use a placeholder
      result.push({
        userId,
        date,
        fullName,
        plannedStart: '00:00',
        plannedEnd: '00:00',
        sequence: prevSeq + 1,
        cancel: true,
      })
    }
  }

  return result
}

async function updateSequences(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  currentEntries: { date: string }[],
  previousSequences: Map<string, number>
): Promise<void> {
  const upsertRows = currentEntries.map((e) => {
    const prev = previousSequences.get(e.date)
    return {
      user_id: userId,
      date: e.date,
      sequence: prev !== undefined ? prev + 1 : 0,
    }
  })

  const cancelledDates = [...previousSequences.keys()].filter(
    (d) => !currentEntries.some((e) => e.date === d)
  )

  if (upsertRows.length > 0) {
    await supabase.from('ics_event_sequences').upsert(upsertRows, { onConflict: 'user_id,date' })
  }

  if (cancelledDates.length > 0) {
    await supabase
      .from('ics_event_sequences')
      .delete()
      .eq('user_id', userId)
      .in('date', cancelledDates)
  }
}
