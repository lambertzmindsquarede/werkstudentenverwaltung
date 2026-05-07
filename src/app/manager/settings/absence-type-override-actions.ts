'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export interface GlobalTypeStatus {
  global_id: string
  name: string
  color: string | null
  abbreviation: string | null
  global_is_active: boolean
  override_id: string | null
  override_is_active: boolean | null // null = not in overrides (new global type)
}

export interface CustomOverride {
  id: string
  name: string
  color: string | null
  abbreviation: string | null
  is_active: boolean
}

export interface BereichConfig {
  bereich_id: string
  bereich_name: string
  has_overrides: boolean
  global_types: GlobalTypeStatus[]
  custom_types: CustomOverride[]
  new_global_type_ids: string[] // active global types added after first override (not yet referenced)
}

async function assertManagerForBereich(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  bereichId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (profile?.is_admin) return true

  const { data } = await supabase
    .from('bereich_manager')
    .select('bereich_id')
    .eq('user_id', userId)
    .eq('bereich_id', bereichId)
    .maybeSingle()

  return !!data
}

export async function loadManagerBereiche(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: assignments } = await supabase
    .from('bereich_manager')
    .select('bereich_id, bereiche(id, name)')
    .eq('user_id', user.id)

  return ((assignments ?? []) as unknown as { bereiche: { id: string; name: string } }[]).map(
    (a) => ({ id: a.bereiche.id, name: a.bereiche.name })
  )
}

export async function loadBereichConfig(
  bereichId: string
): Promise<{ data?: BereichConfig; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const isAuthorized = await assertManagerForBereich(supabase, user.id, bereichId)
  if (!isAuthorized) return { error: 'Keine Berechtigung' }

  const { data: bereich } = await supabase
    .from('bereiche')
    .select('id, name')
    .eq('id', bereichId)
    .single()
  if (!bereich) return { error: 'Bereich nicht gefunden' }

  const { data: globalTypesRaw } = await supabase
    .from('absence_types')
    .select('id, name, color, abbreviation, is_active')
    .order('created_at')

  const globalTypes = globalTypesRaw ?? []

  const { data: overridesRaw } = await supabase
    .from('absence_type_overrides')
    .select('id, absence_type_id, name, color, abbreviation, is_active, is_custom')
    .eq('bereich_id', bereichId)
    .order('created_at')

  const overrides = overridesRaw ?? []
  const hasOverrides = overrides.length > 0

  const globalOverrides = overrides.filter((o) => !o.is_custom)
  const customOverrides = overrides.filter((o) => o.is_custom)

  const referencedGlobalIds = new Set(
    globalOverrides.map((o) => o.absence_type_id).filter(Boolean)
  )

  const globalTypeStatuses: GlobalTypeStatus[] = globalTypes.map((gt) => {
    const override = globalOverrides.find((o) => o.absence_type_id === gt.id) ?? null
    return {
      global_id: gt.id,
      name: gt.name,
      color: gt.color,
      abbreviation: gt.abbreviation,
      global_is_active: gt.is_active,
      override_id: override?.id ?? null,
      override_is_active: override ? override.is_active : null,
    }
  })

  const newGlobalTypeIds = hasOverrides
    ? globalTypes
        .filter((gt) => gt.is_active && !referencedGlobalIds.has(gt.id))
        .map((gt) => gt.id)
    : []

  return {
    data: {
      bereich_id: bereich.id,
      bereich_name: bereich.name,
      has_overrides: hasOverrides,
      global_types: globalTypeStatuses,
      custom_types: customOverrides.map((o) => ({
        id: o.id,
        name: o.name,
        color: o.color,
        abbreviation: o.abbreviation,
        is_active: o.is_active,
      })),
      new_global_type_ids: newGlobalTypeIds,
    },
  }
}

export async function initOverridesAndToggleGlobal(
  bereichId: string,
  globalTypeId: string,
  setActive: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const isAuthorized = await assertManagerForBereich(supabase, user.id, bereichId)
  if (!isAuthorized) return { error: 'Keine Berechtigung' }

  const { data: existing } = await supabase
    .from('absence_type_overrides')
    .select('id')
    .eq('bereich_id', bereichId)
    .limit(1)

  const hasOverrides = (existing ?? []).length > 0

  if (!hasOverrides) {
    // First customization: copy all global types into overrides
    const { data: globalTypes } = await supabase
      .from('absence_types')
      .select('id, name, color, abbreviation, is_active')
      .order('created_at')

    const inserts = (globalTypes ?? []).map((gt) => ({
      bereich_id: bereichId,
      absence_type_id: gt.id,
      name: gt.name,
      color: gt.color,
      abbreviation: gt.abbreviation,
      is_active: gt.id === globalTypeId ? setActive : gt.is_active,
      is_custom: false,
    }))

    const { error } = await supabase.from('absence_type_overrides').insert(inserts)
    if (error) return { error: error.message }
  } else {
    const { data: existingOverride } = await supabase
      .from('absence_type_overrides')
      .select('id')
      .eq('bereich_id', bereichId)
      .eq('absence_type_id', globalTypeId)
      .eq('is_custom', false)
      .maybeSingle()

    if (existingOverride) {
      const { error } = await supabase
        .from('absence_type_overrides')
        .update({ is_active: setActive })
        .eq('id', existingOverride.id)
      if (error) return { error: error.message }
    } else {
      // New global type not yet in overrides — add it
      const { data: globalType } = await supabase
        .from('absence_types')
        .select('name, color, abbreviation')
        .eq('id', globalTypeId)
        .single()
      if (!globalType) return { error: 'Globaler Typ nicht gefunden' }

      const { error } = await supabase.from('absence_type_overrides').insert({
        bereich_id: bereichId,
        absence_type_id: globalTypeId,
        name: globalType.name,
        color: globalType.color,
        abbreviation: globalType.abbreviation,
        is_active: setActive,
        is_custom: false,
      })
      if (error) return { error: error.message }
    }
  }

  revalidatePath('/manager/settings')
  return {}
}

const CustomTypeSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  abbreviation: z.string().max(2).nullable().optional(),
})

export async function addCustomAbsenceType(
  bereichId: string,
  input: z.infer<typeof CustomTypeSchema>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const isAuthorized = await assertManagerForBereich(supabase, user.id, bereichId)
  if (!isAuthorized) return { error: 'Keine Berechtigung' }

  const parsed = CustomTypeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ungültige Eingabe' }

  const { error } = await supabase.from('absence_type_overrides').insert({
    bereich_id: bereichId,
    absence_type_id: null,
    name: parsed.data.name,
    color: parsed.data.color ?? null,
    abbreviation: parsed.data.abbreviation ?? null,
    is_active: true,
    is_custom: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/manager/settings')
  return {}
}

export async function deleteCustomAbsenceType(
  bereichId: string,
  overrideId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const isAuthorized = await assertManagerForBereich(supabase, user.id, bereichId)
  if (!isAuthorized) return { error: 'Keine Berechtigung' }

  const { error } = await supabase
    .from('absence_type_overrides')
    .delete()
    .eq('id', overrideId)
    .eq('bereich_id', bereichId)
    .eq('is_custom', true)

  if (error) return { error: error.message }
  revalidatePath('/manager/settings')
  return {}
}

export async function resetBereichToGlobal(bereichId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const isAuthorized = await assertManagerForBereich(supabase, user.id, bereichId)
  if (!isAuthorized) return { error: 'Keine Berechtigung' }

  const { error } = await supabase
    .from('absence_type_overrides')
    .delete()
    .eq('bereich_id', bereichId)

  if (error) return { error: error.message }
  revalidatePath('/manager/settings')
  return {}
}
