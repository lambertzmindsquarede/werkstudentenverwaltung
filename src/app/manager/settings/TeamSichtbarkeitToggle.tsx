'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { setTeamVisibility } from './sublocation-actions'

interface Props {
  bereichId: string
  bereichName: string
  initialVisibility: 'team' | 'global'
}

export default function TeamSichtbarkeitToggle({
  bereichId,
  bereichName,
  initialVisibility,
}: Props) {
  const [visibility, setVisibility] = useState(initialVisibility)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    const newVisibility = checked ? 'global' : 'team'
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await setTeamVisibility(bereichId, newVisibility)
      if (result.error) {
        setError(result.error)
      } else {
        setVisibility(newVisibility)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
      }
    })
  }

  return (
    <Card className="border-slate-200 shadow-sm max-w-md mt-6">
      <CardHeader>
        <CardTitle>Team-Sichtbarkeit</CardTitle>
        <CardDescription>
          Lege fest, ob {bereichName} für alle App-Nutzer oder nur für dein Team sichtbar ist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id="team-visibility"
            checked={visibility === 'global'}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <Label htmlFor="team-visibility" className="cursor-pointer">
            {visibility === 'global' ? 'Global sichtbar (für alle Nutzer)' : 'Nur Team (Standard)'}
          </Label>
        </div>
        <p className="text-xs text-slate-500">
          Standard: „Nur Team" – dein Team sieht nur sich selbst. Aktiviere „Global", damit andere
          Teams euer Team in der Team-Anwesenheitsübersicht sehen können.
        </p>

        {success && (
          <Alert className="border-green-300 bg-green-50">
            <AlertDescription className="text-green-700 text-sm">
              Sichtbarkeit gespeichert.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="border-red-300 bg-red-50">
            <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
