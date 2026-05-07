'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getWeekDates, dateToString } from '@/lib/week-utils'
import type {
  AbsenceWithType,
  ResolvedAbsenceType,
} from '@/lib/database.types'
import { DEFAULT_ABSENCE_TYPES } from '@/lib/database.types'

export async function getResolvedAbsenceTypes(): Promise<{
  data: ResolvedAbsenceType[]
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: DEFAULT_ABSENCE_TYPES }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('bereich_id')
      .eq('id', user.id)
      .single()

    const bereichId = profile?.bereich_id

    if (bereichId) {
      const { data: overrides, error: overrideError } = await supabase
        .from('absence_type_overrides')
        .select('id, name, color, abbreviation, is_custom')
        .eq('bereich_id', bereichId)
        .eq('is_active', true)
        .order('created_at')

      if (!overrideError && overrides && overrides.length > 0) {
        return {
          data: overrides.map((o) => ({
            id: o.id,
            name: o.name,
            color: o.color,
            abbreviation: o.abbreviation,
            is_custom: o.is_custom ?? false,
            is_override: true,
          })),
        }
      }
    }

    const { data: types, error: typesError } = await supabase
      .from('absence_types')
      .select('id, name, color, abbreviation')
      .eq('is_active', true)
      .order('created_at')

    if (typesError || !types || types.length === 0) {
      return { data: DEFAULT_ABSENCE_TYPES }
    }

    return {
      data: types.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        abbreviation: t.abbreviation,
        is_custom: false,
        is_override: false,
      })),
    }
  } catch {
    return { data: DEFAULT_ABSENCE_TYPES }
  }
}

export async function loadWeekAbsences(weekStr: string): Promise<{
  data: AbsenceWithType[]
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const dates = getWeekDates(weekStr).map(dateToString)

  try {
    const { data, error } = await supabase
      .from('absences')
      .select(
        '*, absence_type:absence_types(id, name, color, abbreviation), absence_type_override:absence_type_overrides(id, name, color, abbreviation)'
      )
      .eq('user_id', user.id)
      .in('date', dates)

    if (error) return { data: [] }
    return { data: (data ?? []) as AbsenceWithType[] }
  } catch {
    return { data: [] }
  }
}

const CreateAbsenceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  typeId: z.string().min(1),
  isOverrideType: z.boolean(),
  note: z.string().max(100).nullable().optional(),
  typeName: z.string().min(1),
  typeColor: z.string().nullable().optional(),
  typeAbbreviation: z.string().nullable().optional(),
  skipActualEntriesCheck: z.boolean().optional(),
})

export async function createAbsence(
  input: z.infer<typeof CreateAbsenceSchema>
): Promise<{ data?: AbsenceWithType; error?: string; requiresConfirmation?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const parsed = CreateAbsenceSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ungültige Eingabe' }

  // Defense-in-depth: check absences_enabled for the user's bereich
  const { data: profileWithBereich } = await supabase
    .from('profiles')
    .select('bereich_id, bereiche(absences_enabled)')
    .eq('id', user.id)
    .single()

  const bereichData = profileWithBereich?.bereiche as unknown as { absences_enabled: boolean } | null
  if (profileWithBereich?.bereich_id && bereichData?.absences_enabled === false) {
    return { error: 'Abwesenheitsverwaltung ist für diesen Bereich deaktiviert.' }
  }

  const { date, typeId, isOverrideType, note, skipActualEntriesCheck } = parsed.data

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv', {
    timeZone: 'Europe/Berlin',
  })

  if (date < sevenDaysAgoStr) {
    return {
      error:
        'Abwesenheit kann maximal 7 Tage rückwirkend eingetragen werden.',
    }
  }

  try {
    if (!skipActualEntriesCheck) {
      const { data: actualEntries } = await supabase
        .from('actual_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .limit(1)

      if (actualEntries && actualEntries.length > 0) {
        return { requiresConfirmation: true }
      }
    }

    const { data: existing } = await supabase
      .from('absences')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle()

    if (existing) {
      return {
        error:
          'Für diesen Tag ist bereits eine Abwesenheit eingetragen. Bitte lösche sie zuerst.',
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('bereich_id')
      .eq('id', user.id)
      .single()

    const isDefaultType = typeId.startsWith('default-')
    const insertData: Record<string, unknown> = {
      user_id: user.id,
      bereich_id: profile?.bereich_id ?? null,
      date,
      note: note ?? null,
      absence_type_id: isDefaultType || isOverrideType ? null : typeId,
      absence_type_override_id: isOverrideType ? typeId : null,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('absences')
      .insert(insertData)
      .select(
        '*, absence_type:absence_types(id, name, color, abbreviation), absence_type_override:absence_type_overrides(id, name, color, abbreviation)'
      )
      .single()

    if (insertError) return { error: insertError.message }

    revalidatePath('/dashboard/wochenplanung')
    return { data: inserted as AbsenceWithType }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unbekannter Fehler' }
  }
}

export async function deleteAbsence(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  try {
    const { data: absence } = await supabase
      .from('absences')
      .select('user_id, date')
      .eq('id', id)
      .single()

    if (!absence) return { error: 'Abwesenheit nicht gefunden' }
    if (absence.user_id !== user.id) return { error: 'Zugriff verweigert' }

    // Defense-in-depth: check absences_enabled for the user's bereich
    const { data: profileWithBereich } = await supabase
      .from('profiles')
      .select('bereich_id, bereiche(absences_enabled)')
      .eq('id', user.id)
      .single()

    const bereichData = profileWithBereich?.bereiche as unknown as { absences_enabled: boolean } | null
    if (profileWithBereich?.bereich_id && bereichData?.absences_enabled === false) {
      return { error: 'Abwesenheitsverwaltung ist für diesen Bereich deaktiviert.' }
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv', {
      timeZone: 'Europe/Berlin',
    })

    if (absence.date < sevenDaysAgoStr) {
      return {
        error:
          'Diese Abwesenheit kann nicht mehr gelöscht werden (Bearbeitungsfrist abgelaufen).',
      }
    }

    const { error } = await supabase.from('absences').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/dashboard/wochenplanung')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unbekannter Fehler' }
  }
}
