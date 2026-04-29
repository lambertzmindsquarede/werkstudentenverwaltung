'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase-browser'

export default function ManagerPage() {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top navigation */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/mindsquare-logo.svg"
            alt="mindsquare"
            width={130}
            height={32}
          />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2.5 py-1 rounded-full">
            Manager
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
        <div className="max-w-5xl mx-auto flex gap-1">
          <a
            href="/manager"
            className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-blue-600"
          >
            Übersicht
          </a>
          <a
            href="/manager/users"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Nutzerverwaltung
          </a>
          <a
            href="/manager/kalender"
            className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            Kalenderansicht
          </a>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Manager-Übersicht</h1>
          <p className="text-slate-500 mt-1 text-sm">Anwesenheiten und Stunden deiner Werkstudenten</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Aktive Werkstudenten
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Noch keine Nutzer angelegt</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Heute anwesend
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Keine Einstempelungen heute</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Ausstehende Freischaltungen
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Alle Konten sind freigeschalten</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
          <p className="text-slate-500 text-sm">
            Weitere Features kommen bald — Auswertung &amp; Export (PROJ-6).
          </p>
        </div>
      </main>
    </div>
  )
}
