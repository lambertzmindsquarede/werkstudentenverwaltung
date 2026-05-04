'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/lib/database.types'

export type ActionResult = { error?: string }

export async function updateUserProfile(
  userId: string,
  updates: {
    role?: UserRole | null
    weekly_hour_limit?: number
    is_active?: boolean
    bundesland?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'manager') return { error: 'Keine Berechtigung' }

  // Last-manager protection: block if this action would leave zero active managers
  if ('role' in updates || updates.is_active === false) {
    const { data: target } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', userId)
      .single()

    const targetIsManager = target?.role === 'manager'
    const losingManagerRole = 'role' in updates && updates.role !== 'manager'
    const beingDeactivated = updates.is_active === false

    if (targetIsManager && (losingManagerRole || beingDeactivated)) {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'manager')
        .eq('is_active', true)
        .neq('id', userId)

      if ((count ?? 0) === 0) {
        return { error: 'Mindestens ein aktiver Manager muss verbleiben.' }
      }
    }
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/manager/users')
  return {}
}
