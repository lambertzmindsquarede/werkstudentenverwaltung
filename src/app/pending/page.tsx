'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase-browser'

export default function PendingPage() {
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-xl px-6 py-3 shadow-lg">
                <Image
                  src="/mindsquare-logo.svg"
                  alt="mindsquare"
                  width={160}
                  height={38}
                  priority
                />
              </div>
            </div>

            {/* Clock icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
                </svg>
              </div>
            </div>

            <CardTitle className="text-xl font-semibold text-white">
              Warte auf Freischaltung
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm mt-2 leading-relaxed">
              Dein Konto wurde erfolgreich angelegt. Ein Administrator muss dir
              noch eine Rolle zuweisen, bevor du die App nutzen kannst.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <p className="text-slate-300 text-sm text-center">
                Wende dich an deinen Vorgesetzten oder die IT, um deinen Zugang
                freischalten zu lassen.
              </p>
            </div>

            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full border-white/20 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Abmelden
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
