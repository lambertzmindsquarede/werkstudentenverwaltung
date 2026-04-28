'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase-browser'

export function MicrosoftSignInButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile',
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (err) {
      setError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={handleSignIn}
        disabled={loading}
        className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium text-sm transition-all duration-200 hover:shadow-md"
        variant="outline"
      >
        {loading ? (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            <span>Anmeldung läuft…</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Microsoft logo */}
            <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            <span>Mit Microsoft anmelden</span>
          </div>
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
