'use client'

// DEV-ONLY: Only rendered when NEXT_PUBLIC_DEV_LOGIN_ENABLED=true
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase-browser'

const DEV_USERS = [
  { userId: '00000000-0000-0000-0000-000000000001', label: 'Dev Admin (Manager)' },
  { userId: '00000000-0000-0000-0000-000000000002', label: 'Anna Müller (Werkstudentin)' },
  { userId: '00000000-0000-0000-0000-000000000003', label: 'Ben Schneider (Werkstudent)' },
  { userId: '00000000-0000-0000-0000-000000000004', label: 'Clara Fischer (Werkstudentin)' },
]

export function DevLoginButton() {
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(DEV_USERS[0].userId)

  if (process.env.NEXT_PUBLIC_DEV_LOGIN_ENABLED !== 'true') {
    return null
  }

  async function handleDevLogin() {
    try {
      setLoading(true)
      const supabase = createClient()

      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      })
      const data = await res.json()

      if (!res.ok) {
        const msg =
          res.status === 404
            ? 'User nicht gefunden — bitte Seed-Script ausführen (docs/dev-seed.sql)'
            : (data.error ?? 'Dev-Login fehlgeschlagen.')
        toast.error(msg)
        return
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: 'email',
      })
      if (error) {
        toast.error('Session-Fehler: ' + error.message)
        return
      }

      window.location.href = data.redirectTo
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
      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
        <SelectTrigger className="w-full mb-2 bg-amber-500/10 border-amber-500/30 text-amber-200 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEV_USERS.map((user) => (
            <SelectItem key={user.userId} value={user.userId}>
              {user.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
          'Als gewählten User einloggen'
        )}
      </Button>
    </div>
  )
}
