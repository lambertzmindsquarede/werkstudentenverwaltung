'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase-browser'
import type { Profile } from '@/lib/database.types'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setLoading(false)
    }
    fetchProfile()
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/mindsquare-logo.svg" alt="mindsquare" width={130} height={32} />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2.5 py-1 rounded-full">
            Werkstudent
          </span>
          <Button
            onClick={handleSignOut}
            disabled={signingOut}
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700"
          >
            {signingOut ? 'Abmelden…' : 'Abmelden'}
          </Button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-3xl mx-auto flex gap-1">
          <a
            href="/dashboard"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Dashboard
          </a>
          <a
            href="/dashboard/profile"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600"
          >
            Mein Profil
          </a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Mein Profil</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Deine Kontodaten aus Azure AD (schreibgeschützt)
          </p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">Kontodaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                      {getInitials(profile?.full_name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {profile?.full_name ?? '—'}
                    </p>
                    <p className="text-sm text-slate-500">{profile?.email ?? '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                      Rolle
                    </p>
                    {profile?.role ? (
                      <Badge
                        variant="outline"
                        className="bg-slate-100 text-slate-700 border-slate-200"
                      >
                        Werkstudent
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-yellow-50 text-yellow-700 border-yellow-200"
                      >
                        Ausstehend
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                      Max. Wochenstunden
                    </p>
                    <p className="text-sm font-medium text-slate-800">
                      {profile?.weekly_hour_limit != null
                        ? `${profile.weekly_hour_limit}h / Woche`
                        : '20h / Woche'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Name und E-Mail werden automatisch aus Azure AD übernommen und können hier nicht
                    geändert werden.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
