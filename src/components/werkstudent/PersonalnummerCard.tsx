'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase-browser'

interface Props {
  userId: string
  initialValue: string | null
}

export default function PersonalnummerCard({ userId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const trimmed = value.trim()
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ personalnummer: trimmed || null })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      toast.error('Fehler beim Speichern.')
    } else {
      toast.success('Personalnummer gespeichert.')
    }
  }

  const isDirty = value.trim() !== (initialValue ?? '').trim()

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-slate-800">Personalnummer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          Wird automatisch in den monatlichen Stundenzettel übernommen. Deine Personalnummer findest
          du auf deiner Gehaltsabrechnung.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="personalnummer">Personalnummer</Label>
            <Input
              id="personalnummer"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="z.B. 12345"
              className="max-w-xs"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
        {!value.trim() && (
          <p className="text-xs text-amber-600">
            Ohne Personalnummer ist der Stundenzettel-Export nicht möglich.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
