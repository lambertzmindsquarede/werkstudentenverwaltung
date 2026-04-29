'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase-browser'

export function ManagerSignOutButton() {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <Button
      onClick={handleSignOut}
      disabled={signingOut}
      variant="ghost"
      size="sm"
      className="text-slate-500 hover:text-slate-700"
    >
      {signingOut ? 'Abmelden…' : 'Abmelden'}
    </Button>
  )
}
