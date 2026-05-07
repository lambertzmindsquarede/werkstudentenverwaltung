'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { AbsenceType } from '@/lib/database.types'
import { DEFAULT_ABSENCE_TYPES } from '@/lib/database.types'

export async function loadGlobalAbsenceTypes(): Promise<{
  data: AbsenceType[]
  error?: string
  usingDefaults?: boolean
}> {
  const admin = createAdminClient()
  try {
    const { data, error } = await admin
      .from('absence_types')
      .select('*')
      .order('created_at')

    if (error) {
      return { data: DEFAULT_ABSENCE_TYPES as unknown as AbsenceType[], usingDefaults: true }
    }
    return { data: (data ?? []) as AbsenceType[] }
  } catch {
    return { data: DEFAULT_ABSENCE_TYPES as unknown as AbsenceType[], usingDefaults: true }
  }
}

const CreateTypeSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  abbreviation: z.string().max(2).nullable().optional(),
})

export async function createAbsenceType(
  input: z.infer<typeof CreateTypeSchema>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { error: 'Keine Berechtigung' }

  const parsed = CreateTypeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ungültige Eingabe' }

  const admin = createAdminClient()
  const { error } = await admin.from('absence_types').insert({
    name: parsed.data.name,
    color: parsed.data.color ?? null,
    abbreviation: parsed.data.abbreviation ?? null,
    is_active: true,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/abwesenheitstypen')
  return {}
}

export async function toggleAbsenceTypeActive(
  id: string,
  isActive: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { error: 'Keine Berechtigung' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('absence_types')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/abwesenheitstypen')
  return {}
}

export interface BereichOverrideStatus {
  id: string
  name: string
  hasOverrides: boolean
  activeOverrideCount: number
}

export async function loadBereichOverrideStatus(): Promise<{
  data: BereichOverrideStatus[]
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Nicht authentifiziert' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { data: [], error: 'Keine Berechtigung' }

  const admin = createAdminClient()
  const [bereicheResult, overridesResult] = await Promise.all([
    admin.from('bereiche').select('id, name').order('name'),
    admin.from('absence_type_overrides').select('bereich_id, id, is_active'),
  ])

  const data: BereichOverrideStatus[] = (bereicheResult.data ?? []).map((b) => {
    const bOverrides = (overridesResult.data ?? []).filter((o) => o.bereich_id === b.id)
    return {
      id: b.id,
      name: b.name,
      hasOverrides: bOverrides.length > 0,
      activeOverrideCount: bOverrides.filter((o) => o.is_active).length,
    }
  })

  return { data }
}

export async function updateAbsenceType(
  id: string,
  input: z.infer<typeof CreateTypeSchema>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { error: 'Keine Berechtigung' }

  const parsed = CreateTypeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ungültige Eingabe' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('absence_types')
    .update({
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      abbreviation: parsed.data.abbreviation ?? null,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/abwesenheitstypen')
  return {}
}
