'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { UserRole, Profile, Bereich } from '@/lib/database.types'

export type ActionResult = { error?: string }

export type GetUsersResult = {
  users: Profile[]
  managers: Profile[]
  isAdmin: boolean
  bereiche: Bereich[]
}

export async function getUsersForManager(
  bereichFilter?: string | null
): Promise<GetUsersResult | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!callerProfile) return { error: 'Profil nicht gefunden' }
  if (callerProfile.role !== 'manager' && !callerProfile.is_admin) {
    return { error: 'Zugriff verweigert' }
  }

  const { data: allManagers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'manager')
    .eq('is_active', true)
    .order('full_name')

  if (callerProfile.is_admin) {
    const { data: allBereiche } = await supabase.from('bereiche').select('*').order('name')
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (bereichFilter) {
      query = query.eq('bereich_id', bereichFilter)
    }
    const { data: users } = await query
    return {
      users: users ?? [],
      managers: allManagers ?? [],
      isAdmin: true,
      bereiche: allBereiche ?? [],
    }
  }

  // Manager: filter profiles to own bereiche only
  const { data: assignments } = await supabase
    .from('bereich_manager')
    .select('bereich_id')
    .eq('user_id', user.id)

  if (!assignments?.length) {
    return { users: [], managers: allManagers ?? [], isAdmin: false, bereiche: [] }
  }

  const managerBereichIds = assignments.map((a) => a.bereich_id)
  const [{ data: managerBereiche }, { data: filteredUsers }] = await Promise.all([
    supabase.from('bereiche').select('*').in('id', managerBereichIds).order('name'),
    supabase
      .from('profiles')
      .select('*')
      .in('bereich_id', managerBereichIds)
      .order('created_at', { ascending: false }),
  ])

  return {
    users: filteredUsers ?? [],
    managers: allManagers ?? [],
    isAdmin: false,
    bereiche: managerBereiche ?? [],
  }
}

export async function updateUserProfile(
  userId: string,
  updates: {
    role?: UserRole | null
    weekly_hour_limit?: number
    is_active?: boolean
    bundesland?: string
    manager_id?: string | null
  }
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!caller?.is_admin && caller?.role !== 'manager') return { error: 'Keine Berechtigung' }

  // Manager (non-admin): verify target werkstudent is in one of their bereiche
  if (!caller?.is_admin && caller?.role === 'manager') {
    const { data: target } = await supabase
      .from('profiles')
      .select('bereich_id, role')
      .eq('id', userId)
      .single()

    if (target?.role !== 'werkstudent') return { error: 'Kein Zugriff auf diesen Nutzer.' }
    if (!target.bereich_id) return { error: 'Kein Zugriff auf diesen Werkstudenten.' }
    const { count } = await supabase
      .from('bereich_manager')
      .select('*', { count: 'exact', head: true })
      .eq('bereich_id', target.bereich_id)
      .eq('user_id', user.id)
    if ((count ?? 0) === 0) return { error: 'Kein Zugriff auf diesen Werkstudenten.' }
  }

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

  if (updates.manager_id) {
    const { data: mgr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', updates.manager_id)
      .single()
    if (mgr?.role !== 'manager') return { error: 'Ungültiger Vorgesetzter.' }
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/manager/users')
  return {}
}
