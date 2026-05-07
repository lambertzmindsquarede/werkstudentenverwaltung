'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ManagerSignOutButton } from '@/components/ManagerSignOutButton'

interface Props {
  isAdmin: boolean
}

const NAV_ITEMS = [
  { href: '/manager', label: 'Übersicht', exact: true },
  { href: '/manager/users', label: 'Nutzerverwaltung', exact: false },
  { href: '/manager/kalender', label: 'Kalenderansicht', exact: false },
  { href: '/manager/team', label: 'Team', exact: false },
  { href: '/manager/abwesenheiten', label: 'Abwesenheiten', exact: false },
  { href: '/manager/arbeitsorte', label: 'Arbeitsorte', exact: false },
  { href: '/manager/settings', label: 'Einstellungen', exact: false },
]

export default function ManagerNav({ isAdmin }: Props) {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean): boolean {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/logo-mindsquare-176x781.webp" alt="mindsquare" width={90} height={40} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3">
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
      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => (
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
          {isAdmin && (
            <Link
              href="/admin"
              className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 border-transparent text-purple-600 hover:text-purple-700 hover:border-purple-300 transition-colors"
            >
              Admin-Bereich
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}
