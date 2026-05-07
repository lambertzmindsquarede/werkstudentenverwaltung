'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type SubLocation = {
  id: string
  arbeitsort_id: string
  name: string
  is_active: boolean
  created_at: string
}

export type Arbeitsort = {
  id: string
  name: string
  is_active: boolean
}

async function assertManagerOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .single()
  return profile?.role === 'manager' || profile?.is_admin === true
}

export async function getManagerArbeitsorte(): Promise<{ data: Arbeitsort[] | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht authentifiziert' }

  const { data, error } = await supabase
    .from('arbeitsorte')
    .select('id, name, is_active')
    .eq('manager_id', user.id)
    .eq('is_active', true)
    .order('name')

  if (error) return { data: null, error: error.message }
  return { data: data as Arbeitsort[] }
}

export async function getSubLocations(
  arbeitsortId: string
): Promise<{ data: SubLocation[] | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht authentifiziert' }

  const { data, error } = await supabase
    .from('sub_locations')
    .select('id, arbeitsort_id, name, is_active, created_at')
    .eq('arbeitsort_id', arbeitsortId)
    .order('name')

  if (error) return { data: null, error: error.message }
  return { data: data as SubLocation[] }
}

const nameSchema = z.string().min(1).max(50)

export async function createSubLocation(
  arbeitsortId: string,
  name: string
): Promise<{ error?: string }> {
  const parsed = nameSchema.safeParse(name.trim())
  if (!parsed.success) return { error: 'Name muss 1–50 Zeichen lang sein.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  if (!(await assertManagerOrAdmin(supabase, user.id))) return { error: 'Keine Berechtigung' }

  const { error } = await supabase.from('sub_locations').insert({
    arbeitsort_id: arbeitsortId,
    name: parsed.data,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Dieser Name existiert bereits.' }
    return { error: error.message }
  }

  revalidatePath('/manager/settings')
  return {}
}

export async function updateSubLocation(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const parsed = nameSchema.safeParse(name.trim())
  if (!parsed.success) return { error: 'Name muss 1–50 Zeichen lang sein.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  if (!(await assertManagerOrAdmin(supabase, user.id))) return { error: 'Keine Berechtigung' }

  const { error } = await supabase
    .from('sub_locations')
    .update({ name: parsed.data })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Dieser Name existiert bereits.' }
    return { error: error.message }
  }

  revalidatePath('/manager/settings')
  return {}
}

export async function toggleSubLocation(
  id: string,
  isActive: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  if (!(await assertManagerOrAdmin(supabase, user.id))) return { error: 'Keine Berechtigung' }

  const { error } = await supabase
    .from('sub_locations')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/manager/settings')
  return {}
}

export async function getTeamVisibility(
  bereichId: string
): Promise<{ data: 'team' | 'global' | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht authentifiziert' }

  const { data, error } = await supabase
    .from('bereiche')
    .select('visibility')
    .eq('id', bereichId)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: (data?.visibility ?? 'team') as 'team' | 'global' }
}

export async function setTeamVisibility(
  bereichId: string,
  visibility: 'team' | 'global'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  if (!(await assertManagerOrAdmin(supabase, user.id))) return { error: 'Keine Berechtigung' }

  const { error } = await supabase
    .from('bereiche')
    .update({ visibility })
    .eq('id', bereichId)

  if (error) return { error: error.message }

  revalidatePath('/manager/settings')
  return {}
}
