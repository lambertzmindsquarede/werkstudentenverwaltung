import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { ManagerSignOutButton } from '@/components/ManagerSignOutButton'
import { loadGlobalAbsenceTypes } from './actions'
import AbwesenheitstypenClient from './AbwesenheitstypenClient'

export const dynamic = 'force-dynamic'

export default async function AdminAbwesenheitstypenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  const { data: types, usingDefaults } = await loadGlobalAbsenceTypes()

  const navItems = [
    { href: '/admin', label: 'Übersicht' },
    { href: '/admin/bereiche', label: 'Bereiche' },
    { href: '/admin/abwesenheitstypen', label: 'Abwesenheitstypen', active: true },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2.5 py-1 rounded-full">
            Admin
          </span>
          <ManagerSignOutButton />
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                item.active
                  ? 'text-slate-900 border-purple-600'
                  : 'text-slate-500 hover:text-slate-700 border-transparent hover:border-slate-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <AbwesenheitstypenClient initialTypes={types} usingDefaults={usingDefaults ?? false} />
    </div>
  )
}
