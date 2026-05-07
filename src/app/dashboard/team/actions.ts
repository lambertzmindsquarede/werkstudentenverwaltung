'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type SubLocation = {
  id: string
  arbeitsort_id: string
  name: string
  is_active: boolean
}

export type PersonPresence = {
  user_id: string
  full_name: string | null
  // group classification
  group_type: 'arbeitsort' | 'absence' | 'no_status'
  group_label: string // e.g. "Homeoffice", "Urlaub", "Kein Status"
  arbeitsort_id: string | null
  // sub-location
  sub_location_id: string | null
  sub_location_name: string | null
}

export type TeamPresenceData = {
  me: PersonPresence | null
  teams: {
    bereich_id: string
    bereich_name: string
    members: PersonPresence[]
  }[]
}

export async function getTeamPresence(date: string): Promise<{ data: TeamPresenceData | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht authentifiziert' }

  // Get self profile to determine own bereich
  const { data: selfProfile } = await supabase
    .from('profiles')
    .select('bereich_id, role')
    .eq('id', user.id)
    .single()

  const selfBereichId = selfProfile?.bereich_id ?? null

  // Load all bereiche visible to the user:
  // - own bereich
  // - globally visible bereiche
  const { data: bereiche } = await supabase
    .from('bereiche')
    .select('id, name, visibility')

  if (!bereiche) return { data: { me: null, teams: [] } }

  const visibleBereiche = bereiche.filter(
    (b) => b.id === selfBereichId || b.visibility === 'global'
  )

  if (visibleBereiche.length === 0 && !selfBereichId) {
    return { data: { me: null, teams: [] } }
  }

  const visibleBereichIds = visibleBereiche.map((b) => b.id)

  // Load all werkstudenten in visible bereiche
  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, bereich_id')
    .in('bereich_id', visibleBereichIds)
    .eq('role', 'werkstudent')
    .eq('is_active', true)
    .limit(500)

  const memberIds = (members ?? []).map((m) => m.id)

  // Load today's planned arbeitsort for each member
  const { data: plannedEntries } = memberIds.length > 0
    ? await supabase
        .from('planned_entries')
        .select('user_id, arbeitsort_id')
        .in('user_id', memberIds)
        .eq('date', date)
        .limit(1000)
    : { data: [] }

  // Load today's absences for each member
  const { data: absences } = memberIds.length > 0
    ? await supabase
        .from('absences')
        .select('user_id, absence_type_id, absence_type_override_id')
        .in('user_id', memberIds)
        .eq('date', date)
        .limit(500)
    : { data: [] }

  // Load absence type names
  const { data: absenceTypes } = await supabase
    .from('absence_types')
    .select('id, name')
    .limit(100)

  // Load absence type overrides — filtered to visible bereiche only (BUG-20-3)
  const { data: absenceTypeOverrides } = visibleBereichIds.length > 0
    ? await supabase
        .from('absence_type_overrides')
        .select('id, name')
        .in('bereich_id', visibleBereichIds)
        .limit(500)
    : { data: [] }

  // Load daily presence (sub-locations)
  const { data: presences } = memberIds.length > 0
    ? await supabase
        .from('daily_presence')
        .select('user_id, sub_location_id')
        .in('user_id', memberIds)
        .eq('date', date)
        .limit(500)
    : { data: [] }

  // Load sub_location names if any are set
  const subLocationIds = (presences ?? [])
    .map((p) => p.sub_location_id)
    .filter(Boolean) as string[]

  const { data: subLocations } = subLocationIds.length > 0
    ? await supabase.from('sub_locations').select('id, name').in('id', subLocationIds)
    : { data: [] }

  // Load arbeitsorte names
  const arbeitsortIds = [...new Set(
    (plannedEntries ?? []).map((p) => p.arbeitsort_id).filter(Boolean) as string[]
  )]
  const { data: arbeitsorte } = arbeitsortIds.length > 0
    ? await supabase.from('arbeitsorte').select('id, name').in('id', arbeitsortIds)
    : { data: [] }

  // Build lookup maps
  const absenceTypeMap = new Map((absenceTypes ?? []).map((t) => [t.id, t.name]))
  const absenceTypeOverrideMap = new Map((absenceTypeOverrides ?? []).map((t) => [t.id, t.name]))
  const presenceMap = new Map((presences ?? []).map((p) => [p.user_id, p.sub_location_id]))
  const subLocationMap = new Map((subLocations ?? []).map((s) => [s.id, s.name]))
  const arbeitsortMap = new Map((arbeitsorte ?? []).map((a) => [a.id, a.name]))

  // Deduplicate planned entries: pick any arbeitsort per user for today
  const plannedArbeitsortMap = new Map<string, string | null>()
  for (const pe of plannedEntries ?? []) {
    if (!plannedArbeitsortMap.has(pe.user_id)) {
      plannedArbeitsortMap.set(pe.user_id, pe.arbeitsort_id)
    }
  }

  const absenceMap = new Map<string, { typeId: string | null; overrideId: string | null }>()
  for (const ab of absences ?? []) {
    if (!absenceMap.has(ab.user_id)) {
      absenceMap.set(ab.user_id, { typeId: ab.absence_type_id, overrideId: ab.absence_type_override_id })
    }
  }

  type MemberRow = { id: string; full_name: string | null; bereich_id: string | null }

  // Classify each member
  function classifyMember(member: MemberRow): PersonPresence {
    const userId = member.id
    const absence = absenceMap.get(userId)
    const subLocationId = presenceMap.get(userId) ?? null
    const subLocationName = subLocationId ? subLocationMap.get(subLocationId) ?? null : null

    if (absence) {
      const label = absence.overrideId
        ? absenceTypeOverrideMap.get(absence.overrideId) ?? 'Abwesend'
        : absence.typeId
          ? absenceTypeMap.get(absence.typeId) ?? 'Abwesend'
          : 'Abwesend'
      return {
        user_id: userId,
        full_name: member.full_name,
        group_type: 'absence',
        group_label: label,
        arbeitsort_id: null,
        sub_location_id: subLocationId,
        sub_location_name: subLocationName,
      }
    }

    const arbeitsortId = plannedArbeitsortMap.get(userId) ?? null
    if (arbeitsortId) {
      const arbeitsortName = arbeitsortMap.get(arbeitsortId) ?? 'Büro'
      return {
        user_id: userId,
        full_name: member.full_name,
        group_type: 'arbeitsort',
        group_label: arbeitsortName,
        arbeitsort_id: arbeitsortId,
        sub_location_id: subLocationId,
        sub_location_name: subLocationName,
      }
    }

    return {
      user_id: userId,
      full_name: member.full_name,
      group_type: 'no_status',
      group_label: 'Abwesend',
      arbeitsort_id: null,
      sub_location_id: subLocationId,
      sub_location_name: subLocationName,
    }
  }

  // Build teams
  const teams = visibleBereiche.map((bereich) => {
    const bereichMembers = (members ?? [])
      .filter((m) => m.bereich_id === bereich.id)
      .map(classifyMember)
    return {
      bereich_id: bereich.id,
      bereich_name: bereich.name,
      members: bereichMembers,
    }
  })

  // Extract "me" from teams
  let me: PersonPresence | null = null
  for (const team of teams) {
    const myEntry = team.members.find((m) => m.user_id === user.id)
    if (myEntry) {
      me = myEntry
      break
    }
  }

  // BUG-20-2: werkstudent without bereich still gets an "Ich"-section
  if (!me && selfProfile?.role === 'werkstudent') {
    const [profileRes, absenceRes, presenceRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('absences').select('absence_type_id, absence_type_override_id').eq('user_id', user.id).eq('date', date).maybeSingle(),
      supabase.from('daily_presence').select('sub_location_id').eq('user_id', user.id).eq('date', date).maybeSingle(),
    ])
    const ownSubLocId = presenceRes.data?.sub_location_id ?? null
    let ownSubLocName: string | null = null
    if (ownSubLocId) {
      const slRes = await supabase.from('sub_locations').select('name').eq('id', ownSubLocId).single()
      ownSubLocName = slRes.data?.name ?? null
    }
    const ownAbsence = absenceRes.data
    me = {
      user_id: user.id,
      full_name: profileRes.data?.full_name ?? null,
      group_type: ownAbsence ? 'absence' : 'no_status',
      group_label: ownAbsence ? 'Abwesend' : 'Abwesend',
      arbeitsort_id: null,
      sub_location_id: ownSubLocId,
      sub_location_name: ownSubLocName,
    }
  }

  return { data: { me, teams } }
}

export async function getSubLocationsForArbeitsort(
  arbeitsortId: string
): Promise<{ data: SubLocation[] | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht authentifiziert' }

  const { data, error } = await supabase
    .from('sub_locations')
    .select('id, arbeitsort_id, name, is_active')
    .eq('arbeitsort_id', arbeitsortId)
    .eq('is_active', true)
    .order('name')

  if (error) return { data: null, error: error.message }
  return { data: data as SubLocation[] }
}

export async function setSubLocation(
  subLocationId: string | null,
  date: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { error } = await supabase
    .from('daily_presence')
    .upsert(
      {
        user_id: user.id,
        date,
        sub_location_id: subLocationId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return {}
}

export async function getTodayPlannedArbeitsort(
  date: string
): Promise<{ data: { arbeitsort_id: string | null } | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht authentifiziert' }

  const { data } = await supabase
    .from('planned_entries')
    .select('arbeitsort_id')
    .eq('user_id', user.id)
    .eq('date', date)
    .not('arbeitsort_id', 'is', null)
    .limit(1)
    .maybeSingle()

  return { data: { arbeitsort_id: data?.arbeitsort_id ?? null } }
}
