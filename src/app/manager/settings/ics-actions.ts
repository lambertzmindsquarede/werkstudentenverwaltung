'use server'

import { createClient } from '@/lib/supabase-server'
import { z } from 'zod'

export interface IcsSettings {
  ics_enabled: boolean
  additional_emails: string[]
}

export async function loadIcsSettings(): Promise<{ data?: IcsSettings; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data, error } = await supabase
    .from('manager_ics_settings')
    .select('ics_enabled, additional_emails')
    .eq('manager_id', user.id)
    .maybeSingle()

  if (error) return { error: error.message }

  return {
    data: {
      ics_enabled: data?.ics_enabled ?? false,
      additional_emails: data?.additional_emails ?? [],
    },
  }
}

const SaveIcsSchema = z.object({
  ics_enabled: z.boolean(),
  additional_emails: z
    .array(z.string().email('Ungültige E-Mail-Adresse'))
    .max(10, 'Maximal 10 E-Mail-Adressen erlaubt')
    .refine((arr) => new Set(arr).size === arr.length, 'Doppelte E-Mail-Adressen sind nicht erlaubt'),
})

export async function saveIcsSettings(settings: IcsSettings): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const parsed = SaveIcsSchema.safeParse(settings)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }

  const { error } = await supabase.from('manager_ics_settings').upsert(
    {
      manager_id: user.id,
      ics_enabled: parsed.data.ics_enabled,
      additional_emails: parsed.data.additional_emails,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'manager_id' }
  )

  if (error) return { error: error.message }
  return {}
}
