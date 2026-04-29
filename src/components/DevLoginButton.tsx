'use client'

// DEV-ONLY: Only rendered when NEXT_PUBLIC_DEV_LOGIN_ENABLED=true
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase-browser'

export function DevLoginButton() {
  const [loading, setLoading] = useState(false)

  if (process.env.NEXT_PUBLIC_DEV_LOGIN_ENABLED !== 'true') {
    return null
  }

  async function handleDevLogin() {
    try {
      setLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'dev-admin@mindsquare.de',
        password: 'dev-admin-2026',
      })

      if (error) {
        toast.error('Dev-Login fehlgeschlagen: ' + error.message)
        return
      }

      const userId = data.user?.id
      const profileResult = await supabase.from('profiles').select('role').eq('id', userId!).single()
      const role = profileResult.data?.role ?? null
      window.location.href = role === 'manager' ? '/manager' : '/dashboard'
    } catch {
      toast.error('Dev-Login fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-amber-500 hover:bg-amber-500 text-amber-950 text-xs font-semibold">
          Dev only
        </Badge>
        <span className="text-xs text-amber-400">Nur lokal sichtbar</span>
      </div>
      <Button
        onClick={handleDevLogin}
        disabled={loading}
        className="w-full h-10 bg-amber-500 hover:bg-amber-400 text-amber-950 font-medium text-sm border-0"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-900 border-t-transparent rounded-full animate-spin" />
            <span>Einloggen…</span>
          </div>
        ) : (
          'Als Admin einloggen'
        )}
      </Button>
    </div>
  )
}
