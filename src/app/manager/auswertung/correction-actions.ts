'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { z } from 'zod'
import type { ActualEntry } from '@/lib/database.types'

const TimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Ungültiges Zeitformat (HH:MM)')

const CorrectionSchema = z.object({
  actual_start: TimeSchema,
  actual_end: TimeSchema,
  reason: z.string().min(1, 'Begründung ist Pflichtfeld').max(200, 'Begründung max. 200 Zeichen'),
})

const CreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actual_start: TimeSchema,
  actual_end: TimeSchema,
  reason: z.string().min(1, 'Begründung ist Pflichtfeld').max(200, 'Begründung max. 200 Zeichen'),
})

const DeleteSchema = z.object({
  reason: z.string().min(1, 'Begründung ist Pflichtfeld').max(200, 'Begründung max. 200 Zeichen'),
})

function normalizeTime(t: string): string {
  return t.length === 5 ? t + ':00' : t
}

async function assertManagerAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  targetUserId: string
): Promise<{ managerId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht authentifiziert' }

  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_admin, bereich_id')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && !profile.is_admin)) {
    return { error: 'Keine Berechtigung (nur Manager)' }
  }

  // Check that targetUser is in the manager's bereich
  if (!profile.is_admin) {
    const { data: managerBereiche } = await admin
      .from('bereich_manager')
      .select('bereich_id')
      .eq('user_id', user.id)

    const bereichIds = (managerBereiche ?? []).map((b) => b.bereich_id)

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('bereich_id')
      .eq('id', targetUserId)
      .single()

    if (!targetProfile?.bereich_id || !bereichIds.includes(targetProfile.bereich_id)) {
      return { error: 'Kein Zugriff auf diesen Werkstudenten' }
    }
  }

  return { managerId: user.id }
}

export async function updateTimeEntry(
  entryId: string,
  userId: string,
  data: { actual_start: string; actual_end: string; reason: string }
): Promise<{ error?: string; data?: ActualEntry }> {
  const parsed = CorrectionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const admin = createAdminClient()

  const access = await assertManagerAccess(supabase, admin, userId)
  if ('error' in access) return { error: access.error }

  // Fetch current entry to check status and store old values
  const { data: existing } = await admin
    .from('actual_entries')
    .select('status, actual_start, actual_end')
    .eq('id', entryId)
    .single()

  if (!existing) return { error: 'Eintrag nicht gefunden' }
  if (existing.status === 'approved') return { error: 'Genehmigte Einträge können nicht bearbeitet werden' }

  const newStart = normalizeTime(parsed.data.actual_start)
  const newEnd = normalizeTime(parsed.data.actual_end)

  // Validate start < end
  if (newStart >= newEnd) return { error: 'Startzeit muss vor der Endzeit liegen' }

  const { data: updated, error } = await admin
    .from('actual_entries')
    .update({
      actual_start: newStart,
      actual_end: newEnd,
      is_complete: true,
      corrected_by: access.managerId,
      corrected_at: new Date().toISOString(),
      correction_note: parsed.data.reason,
    })
    .eq('id', entryId)
    .select()
    .single()

  if (error || !updated) return { error: error?.message ?? 'Speichern fehlgeschlagen' }

  // Write audit log
  await admin.from('time_entry_corrections').insert({
    time_entry_id: entryId,
    action: 'edit',
    manager_id: access.managerId,
    reason: parsed.data.reason,
    old_start: existing.actual_start ? existing.actual_start.substring(0, 5) : null,
    old_end: existing.actual_end ? existing.actual_end.substring(0, 5) : null,
    new_start: parsed.data.actual_start.substring(0, 5),
    new_end: parsed.data.actual_end.substring(0, 5),
  })

  return { data: updated as unknown as ActualEntry }
}

export async function createTimeEntry(
  userId: string,
  data: { date: string; actual_start: string; actual_end: string; reason: string }
): Promise<{ error?: string; data?: ActualEntry }> {
  const parsed = CreateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const admin = createAdminClient()

  const access = await assertManagerAccess(supabase, admin, userId)
  if ('error' in access) return { error: access.error }

  const newStart = normalizeTime(parsed.data.actual_start)
  const newEnd = normalizeTime(parsed.data.actual_end)

  if (newStart >= newEnd) return { error: 'Startzeit muss vor der Endzeit liegen' }

  const { data: inserted, error } = await admin
    .from('actual_entries')
    .insert({
      user_id: userId,
      date: parsed.data.date,
      actual_start: newStart,
      actual_end: newEnd,
      is_complete: true,
      break_minutes: 0,
      corrected_by: access.managerId,
      corrected_at: new Date().toISOString(),
      correction_note: parsed.data.reason,
    })
    .select()
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Erstellen fehlgeschlagen' }

  // Write audit log
  await admin.from('time_entry_corrections').insert({
    time_entry_id: inserted.id,
    action: 'create',
    manager_id: access.managerId,
    reason: parsed.data.reason,
    new_start: parsed.data.actual_start.substring(0, 5),
    new_end: parsed.data.actual_end.substring(0, 5),
  })

  return { data: inserted as unknown as ActualEntry }
}

export async function deleteTimeEntry(
  entryId: string,
  userId: string,
  data: { reason: string }
): Promise<{ error?: string }> {
  const parsed = DeleteSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const admin = createAdminClient()

  const access = await assertManagerAccess(supabase, admin, userId)
  if ('error' in access) return { error: access.error }

  // Check status
  const { data: existing } = await admin
    .from('actual_entries')
    .select('status, actual_start, actual_end')
    .eq('id', entryId)
    .single()

  if (!existing) return { error: 'Eintrag nicht gefunden' }
  if (existing.status === 'approved') return { error: 'Genehmigte Einträge können nicht gelöscht werden' }

  // Write audit log before deletion
  await admin.from('time_entry_corrections').insert({
    time_entry_id: entryId,
    action: 'delete',
    manager_id: access.managerId,
    reason: parsed.data.reason,
    old_start: existing.actual_start ? existing.actual_start.substring(0, 5) : null,
    old_end: existing.actual_end ? existing.actual_end.substring(0, 5) : null,
  })

  const { error } = await admin.from('actual_entries').delete().eq('id', entryId)
  if (error) return { error: error.message }

  return {}
}
