'use client'

// DEV-ONLY: Only rendered when NEXT_PUBLIC_DEV_LOGIN_ENABLED=true
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DEV_USERS = [
  { userId: '00000000-0000-0000-0000-000000000001', label: 'Mia Schulz (Manager)' },
  { userId: '00000000-0000-0000-0000-000000000002', label: 'Anna Müller (Werkstudentin)' },
  { userId: '00000000-0000-0000-0000-000000000003', label: 'Ben Schneider (Werkstudent)' },
  { userId: '00000000-0000-0000-0000-000000000004', label: 'Clara Fischer (Werkstudentin)' },
]

export function DevLoginButton({ enabled }: { enabled?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(DEV_USERS[0].userId)

  if (!enabled) {
    return null
  }

  async function handleDevLogin() {
    try {
      setLoading(true)

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

      // Session cookies were set server-side on the API response — just navigate.
      window.location.href = data.redirectTo
    } catch {
      toast.error('Dev-Login fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-medium text-slate-400 tracking-wide">Demo-Zugänge</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-full bg-white border-slate-300 text-slate-700 text-sm">
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
          className="w-full h-10 bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Einloggen…</span>
            </div>
          ) : (
            'Als Demo-User anmelden'
          )}
        </Button>
      </div>
    </div>
  )
}
