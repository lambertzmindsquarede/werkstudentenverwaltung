'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { saveIcsSettings, type IcsSettings } from './ics-actions'

interface Props {
  initialSettings: IcsSettings
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function IcsEinstellungen({ initialSettings }: Props) {
  const [enabled, setEnabled] = useState(initialSettings.ics_enabled)
  const [emails, setEmails] = useState<string[]>(initialSettings.additional_emails)
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function addEmail() {
    const trimmed = input.trim().toLowerCase()
    if (!EMAIL_RE.test(trimmed)) {
      setInputError('Ungültige E-Mail-Adresse')
      return
    }
    if (emails.includes(trimmed)) {
      setInputError('Diese E-Mail-Adresse ist bereits eingetragen')
      return
    }
    if (emails.length >= 10) {
      setInputError('Maximal 10 E-Mail-Adressen erlaubt')
      return
    }
    setEmails((prev) => [...prev, trimmed])
    setInput('')
    setInputError(null)
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addEmail()
    }
  }

  function handleSave() {
    setSaveError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveIcsSettings({ ics_enabled: enabled, additional_emails: emails })
      if (result.error) {
        setSaveError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">ICS-Kalendereinladungen</CardTitle>
        <CardDescription>
          Beim Speichern eines Wochenplans erhalten Sie und optionale Empfänger automatisch eine
          .ics-Datei per E-Mail.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Toggle */}
        <div className="flex items-center gap-3">
          <Switch
            id="ics-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={isPending}
          />
          <Label htmlFor="ics-enabled" className="text-sm font-medium">
            ICS-Kalendereinladungen aktivieren
          </Label>
        </div>

        {/* Recipient list — only visible when enabled */}
        {enabled && (
          <div className="space-y-3 pl-1">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                Weitere Empfänger (max. 10)
              </p>
              <p className="text-xs text-slate-500">
                Sie selbst erhalten die E-Mail immer. Hier können Sie zusätzliche Adressen angeben.
              </p>
            </div>

            {/* Existing emails */}
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {emails.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1 text-xs"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="ml-1 rounded-full hover:bg-slate-300 p-0.5 leading-none"
                      aria-label={`${email} entfernen`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add input */}
            {emails.length < 10 && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="name@beispiel.de"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value)
                      setInputError(null)
                    }}
                    onKeyDown={handleKeyDown}
                    className={inputError ? 'border-red-400' : ''}
                    disabled={isPending}
                  />
                  {inputError && <p className="text-xs text-red-500 mt-1">{inputError}</p>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEmail}
                  disabled={isPending || !input.trim()}
                >
                  Hinzufügen
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Save */}
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? 'Wird gespeichert…' : 'Einstellungen speichern'}
          </Button>
          {saved && <p className="text-sm text-green-600">Gespeichert.</p>}
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
