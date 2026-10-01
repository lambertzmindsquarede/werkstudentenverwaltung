'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ManagerSignOutButton } from '@/components/ManagerSignOutButton'
import { useManagerNav } from '@/contexts/ManagerNavContext'

interface Props {
  isAdmin: boolean
}

const BASE_NAV_ITEMS = [
  { href: '/manager', label: 'Übersicht', exact: true },
  { href: '/manager/kalender', label: 'Kalenderansicht', exact: false },
  { href: '/manager/auswertung', label: 'Auswertung', exact: false },
  { href: '/manager/deckung', label: 'Deckungsübersicht', exact: false },
  { href: '/manager/abwesenheiten', label: 'Abwesenheiten', exact: false, requiresAbsences: true },
]

export default function ManagerNav({ isAdmin }: Props) {
  const pathname = usePathname()
  const { showAbwesenheiten } = useManagerNav()
  const navItems = BASE_NAV_ITEMS.filter((item) => !item.requiresAbsences || showAbwesenheiten)

  function isActive(href: string, exact: boolean): boolean {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Image src="/logo-mindsquare-176x781.webp" alt="mindsquare" width={90} height={40} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium truncate">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isAdmin ? 'Admin' : 'Manager'}
          </span>
          <ManagerSignOutButton />
        </div>
      </header>
      <nav className="bg-white border-b border-slate-200 px-6 overflow-x-auto">
        <div className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive(item.href, item.exact)
                  ? 'text-slate-900 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700 border-transparent hover:border-slate-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={isAdmin ? '/admin' : '/admin/users'}
            className="ml-auto px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors"
          >
            Administration →
          </Link>
        </div>
      </nav>
    </>
  )
}
