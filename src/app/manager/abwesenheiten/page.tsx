import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AbwesenheitenClient from './AbwesenheitenClient'
import { loadManagerAbsences, getWerkstudentsForManager } from './actions'
import { DEFAULT_ABSENCE_TYPES } from '@/lib/database.types'
import type { ResolvedAbsenceType } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function ManagerAbwesenheitenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager' && !profile?.is_admin) redirect('/dashboard')

  const [absencesResult, werkstudenten, typesResult] = await Promise.all([
    loadManagerAbsences({}),
    getWerkstudentsForManager(),
    supabase.from('absence_types').select('id, name, color, abbreviation').eq('is_active', true).order('created_at'),
  ])

  const absenceTypes: ResolvedAbsenceType[] =
    typesResult.data && typesResult.data.length > 0
      ? typesResult.data.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          abbreviation: t.abbreviation,
          is_custom: false,
          is_override: false,
        }))
      : DEFAULT_ABSENCE_TYPES

  return (
    <AbwesenheitenClient
      initialAbsences={absencesResult.data}
      werkstudenten={werkstudenten}
      absenceTypes={absenceTypes}
      isAdmin={profile?.is_admin ?? false}
    />
  )
}
