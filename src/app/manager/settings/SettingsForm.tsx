'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { saveMaxEditDaysPast } from './actions'

interface Props {
  maxEditDaysPast: number
}

export default function SettingsForm({ maxEditDaysPast }: Props) {
  const [days, setDays] = useState(String(maxEditDaysPast))
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const daysNum = parseInt(days, 10)
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      setResult({ error: 'Bitte einen Wert zwischen 1 und 365 eingeben.' })
      return
    }
    setSaving(true)
    setResult(null)
    const res = await saveMaxEditDaysPast(daysNum)
    setSaving(false)
    if (res.error) {
      setResult({ error: res.error })
    } else {
      setResult({ success: true })
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm max-w-md">
      <CardHeader>
        <CardTitle>Bearbeitungsfrist</CardTitle>
        <CardDescription>
          Wie viele Tage zurück dürfen Werkstudenten ihre Zeiterfassung bearbeiten?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="max-edit-days">Bearbeitungsfrist (Tage)</Label>
            <Input
              id="max-edit-days"
              type="number"
              min={1}
              max={365}
              step={1}
              value={days}
              onChange={(e) => {
                setDays(e.target.value)
                setResult(null)
              }}
              className="mt-1 max-w-[120px]"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Wertebereich 1–365. Heute = Tag 0, gestern = Tag 1. Standard: 14 Tage.
            </p>
          </div>

          {result?.success && (
            <Alert className="border-green-300 bg-green-50">
              <AlertDescription className="text-green-700 text-sm">
                Einstellung gespeichert.
              </AlertDescription>
            </Alert>
          )}
          {result?.error && (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{result.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
