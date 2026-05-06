'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Arbeitsort } from '@/lib/database.types'

const NameSchema = z.string().min(1, 'Name darf nicht leer sein').max(100, 'Name darf max. 100 Zeichen haben')

export async function getArbeitsorte(): Promise<{ data?: Arbeitsort[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data, error } = await supabase
    .from('arbeitsorte')
    .select('*')
    .eq('manager_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data: (data ?? []) as Arbeitsort[] }
}

export async function createArbeitsort(name: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const parsed = NameSchema.safeParse(name.trim())
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data: existing } = await supabase
    .from('arbeitsorte')
    .select('id')
    .eq('manager_id', user.id)
    .eq('name', parsed.data)
    .eq('is_active', true)
    .maybeSingle()

  if (existing) return { error: 'Ein aktiver Arbeitsort mit diesem Namen existiert bereits.' }

  const { error } = await supabase.from('arbeitsorte').insert({
    manager_id: user.id,
    name: parsed.data,
    is_active: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/manager/arbeitsorte')
  return {}
}

export async function updateArbeitsort(id: string, name: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const parsed = NameSchema.safeParse(name.trim())
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data: existing } = await supabase
    .from('arbeitsorte')
    .select('id')
    .eq('manager_id', user.id)
    .eq('name', parsed.data)
    .eq('is_active', true)
    .neq('id', id)
    .maybeSingle()

  if (existing) return { error: 'Ein aktiver Arbeitsort mit diesem Namen existiert bereits.' }

  const { error } = await supabase
    .from('arbeitsorte')
    .update({ name: parsed.data })
    .eq('id', id)
    .eq('manager_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/manager/arbeitsorte')
  return {}
}

export async function toggleArbeitsort(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { error } = await supabase
    .from('arbeitsorte')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('manager_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/manager/arbeitsorte')
  return {}
}
