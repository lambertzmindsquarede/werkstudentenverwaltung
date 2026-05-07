'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import type { PersonPresence, TeamPresenceData } from '@/app/dashboard/team/actions'

export async function getManagerBereiche(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, role')
    .eq('id', user.id)
    .single()

  if (!profile) return []

  const admin = createAdminClient()

  if (profile.is_admin) {
    const { data } = await admin.from('bereiche').select('id, name').order('name')
    return data ?? []
  }

  if (profile.role === 'manager') {
    const { data: assignments } = await admin
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    if (!assignments?.length) return []

    const ids = assignments.map((a) => a.bereich_id)
    const { data } = await admin.from('bereiche').select('id, name').in('id', ids).order('name')
    return data ?? []
  }

  return []
}

export async function getTeamPresenceForBereich(
  bereichId: string,
  date: string
): Promise<{ data: TeamPresenceData | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht authentifiziert' }

  const admin = createAdminClient()

  const { data: bereich } = await admin
    .from('bereiche')
    .select('id, name')
    .eq('id', bereichId)
    .single()

  if (!bereich) return { data: null, error: 'Bereich nicht gefunden' }

  const { data: members } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('bereich_id', bereichId)
    .eq('role', 'werkstudent')
    .eq('is_active', true)
    .order('full_name')

  const memberIds = (members ?? []).map((m) => m.id)

  if (memberIds.length === 0) {
    return {
      data: {
        me: null,
        teams: [{ bereich_id: bereich.id, bereich_name: bereich.name, members: [] }],
      },
    }
  }

  const [
    { data: plannedEntries },
    { data: absences },
    { data: presences },
    { data: absenceTypes },
    { data: absenceTypeOverrides },
    { data: openEntries },
  ] = await Promise.all([
    admin
      .from('planned_entries')
      .select('user_id, arbeitsort_id')
      .in('user_id', memberIds)
      .eq('date', date),
    admin
      .from('absences')
      .select('user_id, absence_type_id, absence_type_override_id')
      .in('user_id', memberIds)
      .eq('date', date),
    admin
      .from('daily_presence')
      .select('user_id, sub_location_id')
      .in('user_id', memberIds)
      .eq('date', date),
    admin.from('absence_types').select('id, name'),
    admin.from('absence_type_overrides').select('id, name').eq('bereich_id', bereichId),
    admin
      .from('actual_entries')
      .select('user_id, mood_emoji, is_complete')
      .in('user_id', memberIds)
      .eq('date', date),
  ])

  const arbeitsortIds = [
    ...new Set(
      (plannedEntries ?? []).map((p) => p.arbeitsort_id).filter(Boolean) as string[]
    ),
  ]
  const subLocationIds = [
    ...new Set(
      (presences ?? []).map((p) => p.sub_location_id).filter(Boolean) as string[]
    ),
  ]

  const [{ data: arbeitsorte }, { data: subLocations }] = await Promise.all([
    arbeitsortIds.length > 0
      ? admin.from('arbeitsorte').select('id, name').in('id', arbeitsortIds)
      : { data: [] },
    subLocationIds.length > 0
      ? admin.from('sub_locations').select('id, name').in('id', subLocationIds)
      : { data: [] },
  ])

  const absenceTypeMap = new Map((absenceTypes ?? []).map((t) => [t.id, t.name]))
  const absenceTypeOverrideMap = new Map((absenceTypeOverrides ?? []).map((t) => [t.id, t.name]))
  const arbeitsortMap = new Map((arbeitsorte ?? []).map((a) => [a.id, a.name]))
  const subLocationMap = new Map((subLocations ?? []).map((s) => [s.id, s.name]))
  const presenceMap = new Map((presences ?? []).map((p) => [p.user_id, p.sub_location_id]))
  const stampedInSet = new Set((openEntries ?? []).map((e) => e.user_id))
  const moodEmojiMap = new Map(
    (openEntries ?? [])
      .filter((e) => !e.is_complete)
      .map((e) => [e.user_id, e.mood_emoji as string | null])
  )

  const plannedArbeitsortMap = new Map<string, string | null>()
  for (const pe of plannedEntries ?? []) {
    if (!plannedArbeitsortMap.has(pe.user_id)) {
      plannedArbeitsortMap.set(pe.user_id, pe.arbeitsort_id)
    }
  }

  const absenceMap = new Map<string, { typeId: string | null; overrideId: string | null }>()
  for (const ab of absences ?? []) {
    if (!absenceMap.has(ab.user_id)) {
      absenceMap.set(ab.user_id, {
        typeId: ab.absence_type_id,
        overrideId: ab.absence_type_override_id,
      })
    }
  }

  function classify(member: { id: string; full_name: string | null }): PersonPresence {
    const absence = absenceMap.get(member.id)
    const subLocationId = presenceMap.get(member.id) ?? null
    const subLocationName = subLocationId ? (subLocationMap.get(subLocationId) ?? null) : null
    const moodEmoji = moodEmojiMap.get(member.id) ?? null

    if (absence) {
      const label = absence.overrideId
        ? (absenceTypeOverrideMap.get(absence.overrideId) ?? 'Abwesend')
        : absence.typeId
          ? (absenceTypeMap.get(absence.typeId) ?? 'Abwesend')
          : 'Abwesend'
      return {
        user_id: member.id,
        full_name: member.full_name,
        group_type: 'absence',
        group_label: label,
        arbeitsort_id: null,
        sub_location_id: subLocationId,
        sub_location_name: subLocationName,
        mood_emoji: moodEmoji,
      }
    }

    const arbeitsortId = plannedArbeitsortMap.get(member.id) ?? null
    if (arbeitsortId && stampedInSet.has(member.id)) {
      return {
        user_id: member.id,
        full_name: member.full_name,
        group_type: 'arbeitsort',
        group_label: arbeitsortMap.get(arbeitsortId) ?? 'Büro',
        arbeitsort_id: arbeitsortId,
        sub_location_id: subLocationId,
        sub_location_name: subLocationName,
        mood_emoji: moodEmoji,
      }
    }

    return {
      user_id: member.id,
      full_name: member.full_name,
      group_type: 'no_status',
      group_label: 'Abwesend',
      arbeitsort_id: null,
      sub_location_id: subLocationId,
      sub_location_name: subLocationName,
      mood_emoji: moodEmoji,
    }
  }

  return {
    data: {
      me: null,
      teams: [
        {
          bereich_id: bereich.id,
          bereich_name: bereich.name,
          members: (members ?? []).map(classify),
        },
      ],
    },
  }
}
