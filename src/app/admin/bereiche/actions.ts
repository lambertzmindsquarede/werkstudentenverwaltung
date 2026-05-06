'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type ActionResult = { error?: string }

const nameSchema = z
  .string()
  .min(1, 'Name darf nicht leer sein')
  .max(100, 'Name darf max. 100 Zeichen haben')
  .trim()

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
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

  if (!profile?.is_admin) return { error: 'Keine Admin-Berechtigung' }

  return { userId: user.id }
}

async function requireAdminOrManager(): Promise<
  { userId: string; isAdmin: boolean; role: string | null } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, role')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && profile?.role !== 'manager') {
    return { error: 'Keine Berechtigung' }
  }

  return { userId: user.id, isAdmin: profile.is_admin, role: profile.role ?? null }
}

// ─── Bereiche CRUD ────────────────────────────────────────────────────────────

export async function createBereich(name: string): Promise<ActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  const { error } = await admin.from('bereiche').insert({ name: parsed.data })

  if (error) {
    if (error.code === '23505') return { error: 'Dieser Bereichsname ist bereits vergeben.' }
    return { error: error.message }
  }

  revalidatePath('/admin/bereiche')
  return {}
}

export async function renameBereich(id: string, name: string): Promise<ActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  const { error } = await admin.from('bereiche').update({ name: parsed.data }).eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Dieser Bereichsname ist bereits vergeben.' }
    return { error: error.message }
  }

  revalidatePath('/admin/bereiche')
  return {}
}

export async function deleteBereich(id: string): Promise<ActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()

  // Guard: deny deletion if any Werkstudenten are still assigned
  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('bereich_id', id)

  if ((count ?? 0) > 0) {
    return {
      error:
        'Bereich kann nicht gelöscht werden: Es sind noch Werkstudenten zugeordnet. Bitte zuerst alle Werkstudenten in einen anderen Bereich verschieben.',
    }
  }

  const { error } = await admin.from('bereiche').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/bereiche')
  return {}
}

// ─── Manager-Bereich Zuordnung ────────────────────────────────────────────────

export async function addManagerToBereich(
  bereichId: string,
  userId: string
): Promise<ActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()

  // Verify the user exists and has manager role or is_admin
  const { data: target } = await admin
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .single()

  if (!target) return { error: 'Nutzer nicht gefunden.' }
  if (target.role !== 'manager' && !target.is_admin) {
    return { error: 'Nur Manager oder Admins können einem Bereich als Manager zugeordnet werden.' }
  }

  const { error } = await admin
    .from('bereich_manager')
    .insert({ bereich_id: bereichId, user_id: userId })

  if (error) {
    if (error.code === '23505') return { error: 'Nutzer ist diesem Bereich bereits zugeordnet.' }
    return { error: error.message }
  }

  revalidatePath('/admin/bereiche')
  return {}
}

export async function removeManagerFromBereich(
  bereichId: string,
  userId: string
): Promise<ActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()
  const { error } = await admin
    .from('bereich_manager')
    .delete()
    .eq('bereich_id', bereichId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/bereiche')
  return {}
}

// ─── Werkstudent → Bereich zuordnen ─────────────────────────────────────────

export async function assignWerkstudentToBereich(
  werkstudentId: string,
  bereichId: string | null
): Promise<ActionResult> {
  const auth = await requireAdminOrManager()
  if ('error' in auth) return auth

  const admin = createAdminClient()

  // Verify target is a Werkstudent
  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', werkstudentId)
    .single()

  if (!target) return { error: 'Werkstudent nicht gefunden.' }
  if (target.role !== 'werkstudent') return { error: 'Nutzer ist kein Werkstudent.' }

  // Manager darf nur in seinen eigenen Bereich zuordnen
  if (!auth.isAdmin && auth.role === 'manager' && bereichId !== null) {
    const { count } = await admin
      .from('bereich_manager')
      .select('*', { count: 'exact', head: true })
      .eq('bereich_id', bereichId)
      .eq('user_id', auth.userId)

    if ((count ?? 0) === 0) {
      return { error: 'Manager darf nur in eigene Bereiche zuordnen.' }
    }
  }

  const { error } = await admin
    .from('profiles')
    .update({ bereich_id: bereichId })
    .eq('id', werkstudentId)

  if (error) return { error: error.message }

  revalidatePath('/admin/bereiche')
  revalidatePath('/manager/users')
  return {}
}

// ─── Read helpers (for server components) ────────────────────────────────────

export async function getBereiche() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bereiche')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getBereichWithDetails(id: string) {
  const admin = createAdminClient()

  const [{ data: bereich }, { data: managers }, { data: werkstudenten }] = await Promise.all([
    admin.from('bereiche').select('*').eq('id', id).single(),
    admin
      .from('bereich_manager')
      .select('user_id, profiles(id, full_name, email, role, is_admin)')
      .eq('bereich_id', id),
    admin
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('bereich_id', id)
      .eq('role', 'werkstudent')
      .order('full_name'),
  ])

  return { bereich, managers: managers ?? [], werkstudenten: werkstudenten ?? [] }
}

export async function getBereicheWithCounts() {
  const admin = createAdminClient()

  const { data: bereiche } = await admin.from('bereiche').select('*').order('name')
  if (!bereiche) return []

  const counts = await Promise.all(
    bereiche.map(async (b) => {
      const [{ count: managerCount }, { count: werkstudentCount }] = await Promise.all([
        admin
          .from('bereich_manager')
          .select('*', { count: 'exact', head: true })
          .eq('bereich_id', b.id),
        admin
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('bereich_id', b.id)
          .eq('role', 'werkstudent'),
      ])
      return { ...b, managerCount: managerCount ?? 0, werkstudentCount: werkstudentCount ?? 0 }
    })
  )

  return counts
}

export async function getBereicheForAssignment() {
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

  if (profile.is_admin) {
    const { data } = await supabase.from('bereiche').select('*').order('name')
    return data ?? []
  }

  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    if (!assignments?.length) return []

    const bereichIds = assignments.map((a) => a.bereich_id)
    const { data } = await supabase.from('bereiche').select('*').in('id', bereichIds).order('name')
    return data ?? []
  }

  return []
}

export async function getManagersForBereichSelect() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, email, role, is_admin')
    .or('role.eq.manager,is_admin.eq.true')
    .eq('is_active', true)
    .order('full_name')

  return data ?? []
}
